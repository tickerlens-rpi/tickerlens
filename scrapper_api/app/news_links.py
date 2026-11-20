"""Find the original article behind a Finnhub news link.

Finnhub labels most company news 'Yahoo' (the feed it read), whoever wrote it. Its news link
redirects to the original article, so the redirect target names the real publisher. Only
Finnhub's redirect is requested, and only its status and headers are read: the body is never
downloaded and the outlet's page is never loaded.

One resolver serves every request. Its worker pool caps how many lookups run at once across the
whole server, at most MAX_PENDING lookups may be running or queued (beyond that a link is simply
not looked up), answers are cached, and each call stops waiting at a deadline, so a slow or busy
Finnhub costs a news request at most its deadline and the article keeps Finnhub's label.
"""
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, wait
import threading
import time
from urllib.parse import urljoin, urlsplit
import httpx

WORKERS = 4
MAX_PENDING = 32       # lookups running or queued, across all requests
REQUEST_TIMEOUT = 5.0  # per network phase (connect, each read), also clipped to the deadline
ATTEMPTS = 3           # Finnhub answers bursts with 429; retry those briefly
MAX_HOPS = 3           # redirects followed on the link's own host before giving up
CACHE_SIZE = 4000


def host_of(url: str) -> str | None:
    """Lower-case host of `url`, or None when there is none or the URL is malformed."""
    try:
        host = urlsplit(url).hostname
    except ValueError:  # e.g. an unclosed '[' in the authority
        return None
    return host or None


class LinkResolver:
    def __init__(self, client: httpx.Client | None = None, workers: int = WORKERS,
                 max_pending: int = MAX_PENDING):
        self._client = client or httpx.Client(follow_redirects=False, timeout=REQUEST_TIMEOUT)
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="news-link")
        self._max_pending = max_pending
        self._pending = 0
        self._cache: OrderedDict[str, str | None] = OrderedDict()
        self._lock = threading.Lock()

    def resolve(self, urls: list[str], deadline: float) -> dict[str, str]:
        """Original-article URL for each link resolved before `deadline` (time.monotonic()).
        Links that fail, are still waiting at the deadline, or find the resolver full are left out."""
        found, futures, full = {}, {}, False
        for url in dict.fromkeys(urls):
            hit, target = self._cached(url)
            if hit:
                if target:
                    found[url] = target
                continue
            future = None if full else self._submit(url, deadline)
            if future is None:
                full = True  # resolver is full: uncached links keep Finnhub's label
                continue
            futures[future] = url
        if not futures:
            return found
        done, late = wait(futures, timeout=max(0.0, deadline - time.monotonic()))
        for future in late:
            future.cancel()  # not started yet: drop it; running ones stop at the deadline
        for future in done:
            if not future.cancelled() and future.exception() is None and future.result():
                found[futures[future]] = future.result()
        return found

    def _submit(self, url: str, deadline: float):
        with self._lock:
            if self._pending >= self._max_pending:
                return None
            self._pending += 1
        future = self._pool.submit(self._lookup, url, deadline)
        future.add_done_callback(self._release)
        return future

    def _release(self, _future) -> None:
        with self._lock:
            self._pending -= 1

    def _lookup(self, url: str, deadline: float) -> str | None:
        """Follow up to MAX_HOPS redirects that stay on the link's own host (a relative Location
        does), and return the first target that leaves it. Only definite answers are cached:
        network errors, 5xx, 408 and repeated 429 are left for a later request to retry."""
        current, hops, refused = url, 0, 0
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None
            try:
                # stream() returns once the headers arrive; the body is never read.
                with self._client.stream("GET", current, timeout=min(REQUEST_TIMEOUT, remaining)) as response:
                    status, target = response.status_code, self._next_url(current, response)
            except httpx.HTTPError:
                return None
            if status == 429:
                refused += 1
                if refused >= ATTEMPTS:
                    return None
                time.sleep(min(0.4 * refused, max(0.0, deadline - time.monotonic())))
                continue
            if status >= 500 or status == 408:
                return None
            if target and host_of(target) == host_of(url):
                if hops < MAX_HOPS:
                    current, hops = target, hops + 1
                    continue
                target = None  # never left the link's host
            self._remember(url, target)
            return target

    @staticmethod
    def _next_url(current: str, response: httpx.Response) -> str | None:
        """Absolute http(s) URL that `response` redirects to, or None."""
        location = response.headers.get("location") if response.is_redirect else None
        if not location:
            return None
        target = urljoin(current, location)  # Location may be relative
        try:
            scheme = urlsplit(target).scheme
        except ValueError:
            return None
        return target if scheme in ("http", "https") and host_of(target) else None

    def _cached(self, url: str) -> tuple[bool, str | None]:
        with self._lock:
            if url not in self._cache:
                return False, None
            self._cache.move_to_end(url)
            return True, self._cache[url]

    def _remember(self, url: str, target: str | None) -> None:
        with self._lock:
            if target is None and self._cache.get(url):
                return  # a late failure never replaces a link another request resolved
            self._cache[url] = target
            self._cache.move_to_end(url)
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
