"""Helpers for ticker symbols.

Mirrors frontend/src/lib/ticker.ts so both sides agree on what "AAPL",
" aapl " and "$aapl" mean.
"""


def normalize_ticker(raw: str) -> str:
    """Trims, strips a leading `$` and upper-cases a ticker symbol."""
    return raw.strip().removeprefix("$").upper()
