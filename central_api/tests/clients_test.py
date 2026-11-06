"""Tests for the calls to the scraper and the scheduler."""
import httpx
import pytest
from app import clients, config


def test_fetch_builds_the_right_requests(monkeypatch):
    seen = []

    def fake_get(url, params=None, timeout=None):
        seen.append((url, params))
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(httpx, "get", fake_get)
    clients.fetch("overview", "AAPL", None)
    clients.fetch("prices", "AAPL", "1Y")
    clients.fetch("news", "AAPL", "7")
    base = config.SCRAPER_URL
    assert seen == [
        (f"{base}/companies/AAPL/overview", {}),
        (f"{base}/companies/AAPL/prices", {"range": "1Y"}),
        (f"{base}/companies/AAPL/news", {"limit": "7"}),
    ]


@pytest.mark.parametrize(
    ("response", "error"),
    [
        (httpx.Response(404), clients.NotFoundError),
        (httpx.Response(502), clients.UnavailableError),
        (httpx.Response(500), clients.UnavailableError),
        (httpx.Response(200, text="<html>"), clients.UnavailableError),
        (httpx.ConnectError("refused"), clients.UnavailableError),
        (httpx.ReadTimeout("slow"), clients.UnavailableError),
    ],
)
def test_fetch_maps_failures(monkeypatch, response, error):
    def fake_get(*args, **kwargs):
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(httpx, "get", fake_get)
    with pytest.raises(error):
        clients.fetch("overview", "AAPL", None)


class InlineThread:
    """Runs the work at once, so a test need not wait for a thread."""

    def __init__(self, target, args, daemon):
        self.target, self.args = target, args

    def start(self):
        self.target(*self.args)


@pytest.fixture
def posts(monkeypatch):
    sent = []

    def fake_post(url, timeout=None):
        sent.append(url)
        return httpx.Response(200, request=httpx.Request("POST", url))

    clients._last_told.clear()
    monkeypatch.setattr(clients.threading, "Thread", InlineThread)
    monkeypatch.setattr(httpx, "post", fake_post)
    return sent


def test_scheduler_is_told_once_a_minute_per_ticker(posts):
    clients.tell_scheduler("AAPL")
    clients.tell_scheduler("AAPL")
    clients.tell_scheduler("NKE")
    base = config.SCHEDULER_URL
    assert posts == [f"{base}/watch/AAPL", f"{base}/watch/NKE"]
    clients._last_told["AAPL"] -= 61
    clients.tell_scheduler("AAPL")
    assert len(posts) == 3


@pytest.mark.parametrize("failure", [httpx.ConnectError("down"), 500])
def test_scheduler_trouble_is_swallowed_and_retried(
    posts, monkeypatch, failure
):
    def fake_post(url, timeout=None):
        if isinstance(failure, Exception):
            raise failure
        request = httpx.Request("POST", url)
        return httpx.Response(failure, request=request)

    monkeypatch.setattr(httpx, "post", fake_post)
    clients.tell_scheduler("AAPL")  # must not raise
    assert "AAPL" not in clients._last_told  # so the next search tries again
