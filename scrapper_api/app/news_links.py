"""Find the original article behind a Finnhub news link.

Finnhub labels most company news 'Yahoo' (the feed it read), whoever wrote it. Its news link
redirects to the original article, so the redirect target names the real publisher. Only that
one Finnhub hop is requested; the outlet's page is never loaded.

One resolver serves every request: its worker pool caps how many lookups run at once across
the whole server, results are cached, and each call stops waiting at a deadline so a slow
Finnhub cannot make a news request time out.
"""
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, wait
import threading
import time
from urllib.parse import urljoin, urlsplit
import httpx

WORKERS = 4
REQUEST_TIMEOUT = 5.0
ATTEMPTS = 3  # Finnhub answers bursts with 429; retry those briefly
MAX_HOPS = 3  # redirects followed on Finnhub's own host before giving up
CACHE_SIZE = 4000


def host_of(url: str) -> str | None:
    """Lower-case host of `url`, or None when there is none or the URL is malformed."""
    try:
        host = urlsplit(url).hostname
    except ValueError:  # e.g. an unclosed '[' in the authority
        return None
    return host or None


class LinkResolver:
    def __init__(self, client: httpx.Client | None = None, workers: int = WORKERS):
        self._client = client or httpx.Client(follow_redirects=False, timeout=REQUEST_TIMEOUT)
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="news-link")
        self._cache: OrderedDict[str, str | None] = OrderedDict()
        self._lock = threading.Lock()

    def resolve(self, urls: list[str], deadline: float) -> dict[str, str]:
        """Original-article URL for each link resolved before `deadline` (time.monotonic()).
        Links that fail, or are still waiting at the deadline, are left out."""
        found, todo = {}, []
        for url in dict.fromkeys(urls):
            hit, target = self._cached(url)
            if not hit:
                todo.append(url)
            elif target:
                found[url] = target
        if not todo:
            return found
        futures = {self._pool.submit(self._lookup, url, deadline): url for url in todo}
        done, late = wait(futures, timeout=max(0.0, deadline - time.monotonic()))
        for future in late:
            future.cancel()  # not started yet: drop it; running ones finish and fill the cache
        for future in done:
            if not future.cancelled() and future.exception() is None and future.result():
                found[futures[future]] = future.result()
        return found

    def _lookup(self, url: str, deadline: float) -> str | None:
        """Follow redirects while they stay on the link's own host (a relative Location does),
        and return the first one that leaves it. Transient failures are not cached, so a later
        request tries again; a definite answer is."""
        current, hops, refused = url, 0, 0
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None
            try:
                response = self._client.get(current, timeout=min(REQUEST_TIMEOUT, remaining))
            except httpx.HTTPError:
                return None
            if response.status_code == 429:
                refused += 1
                if refused >= ATTEMPTS:
                    return None
                time.sleep(min(0.4 * refused, max(0.0, deadline - time.monotonic())))
                continue
            target = self._next_url(current, response)
            if target and host_of(target) == host_of(url) and hops + 1 < MAX_HOPS:
                current, hops = target, hops + 1
                continue
            if target and host_of(target) == host_of(url):
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
            self._cache[url] = target
            self._cache.move_to_end(url)
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
