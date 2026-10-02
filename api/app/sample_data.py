"""A small fixed set of companies used until the database is connected."""

from app.models import Company

SAMPLE_COMPANIES: tuple[Company, ...] = (
    Company(ticker="AAPL", name="Apple Inc.", exchange="NASDAQ"),
    Company(ticker="AMZN", name="Amazon.com, Inc.", exchange="NASDAQ"),
    Company(ticker="APLE", name="Apple Hospitality REIT", exchange="NYSE"),
    Company(ticker="BRK.B", name="Berkshire Hathaway Inc.", exchange="NYSE"),
    Company(ticker="DIS", name="The Walt Disney Company", exchange="NYSE"),
    Company(ticker="GOOGL", name="Alphabet Inc.", exchange="NASDAQ"),
    Company(ticker="JPM", name="JPMorgan Chase & Co.", exchange="NYSE"),
    Company(ticker="KO", name="The Coca-Cola Company", exchange="NYSE"),
    Company(ticker="MSFT", name="Microsoft Corporation", exchange="NASDAQ"),
    Company(ticker="NKE", name="Nike, Inc.", exchange="NYSE"),
    Company(ticker="NVDA", name="NVIDIA Corporation", exchange="NASDAQ"),
    Company(ticker="SBUX", name="Starbucks Corporation", exchange="NASDAQ"),
    Company(ticker="TSLA", name="Tesla, Inc.", exchange="NASDAQ"),
    Company(ticker="SPCX", name="Space Exploration Technologies Corp.", exchange="NASDAQ")
)
