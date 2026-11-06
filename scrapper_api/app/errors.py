"""Custom exceptions for the market data providers."""

class TickerNotFound(Exception):
    """The provider has no data for this ticker."""


class ProviderError(Exception):
    """The provider failed (network, rate limit, bad response)."""