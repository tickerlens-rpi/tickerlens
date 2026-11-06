"""Builds app/data/companies.csv, the companies the search endpoint knows.

The list comes from Nasdaq Trader's public symbol directory, which covers
every security listed on NASDAQ and the other US exchanges. This script keeps
the operating companies listed on NYSE and NASDAQ: common stock, ordinary
shares and American depositary shares. It drops ETFs, test issues, warrants,
rights, SPAC units, preferred shares and notes.

Run it from central_api/ to refresh the list (about once a month is plenty):

    python scripts/build_company_list.py

or point it at files you downloaded yourself:

    python scripts/build_company_list.py nasdaqlisted.txt otherlisted.txt
"""

import csv
import re
import sys
import urllib.request
from collections.abc import Iterable, Iterator
from pathlib import Path

SOURCE = "https://www.nasdaqtrader.com/dynamic/SymDir/{}.txt"
OUTPUT = Path(__file__).resolve().parent.parent / "app" / "data" / "companies.csv"

# Nasdaq market categories, biggest companies first. NYSE has no categories
# in the directory, so its companies share the top tier.
NASDAQ_TIERS = {"Q": 0, "G": 1, "S": 2}  # Global Select, Global, Capital

# Securities that are not a company's shares.
_NOT_SHARES = re.compile(
    r"\b(warrants?|rights?|units?|preferred|preference|notes?|debentures?|"
    r"subordinated|bonds?|trust certificates?|when[- ]issued)\b|%",
    re.IGNORECASE,
)
# MLPs trade as "common units": those are company shares.
_COMMON_UNITS = re.compile(r"\bcommon units?\b", re.IGNORECASE)
# What follows the company name in a security name, e.g. " - Common Stock",
# " Class B Common Stock", " American Depositary Shares, each ...".
_SECURITY_SUFFIX = re.compile(
    r"\s*(-\s*)?\b(new\s+)?(class [a-z]\s+)?(common stock|capital stock|"
    r"common shares?|ordinary shares?|american deposit[ao]ry (shares|receipts)|"
    r"depositary shares|(new york )?registry shares|common units?|"
    r"shares of beneficial interest|(subordinate |multiple )?voting shares|"
    r"(?<=class [a-z] )shares|common(?= new\b| \(|$))\b.*$",
    re.IGNORECASE,
)
# "Class A" or "Series C", which tell a company's share classes apart.
_SHARE_LABEL = re.compile(r"\b(class|series) ([a-z])\b", re.IGNORECASE)


def read_rows(lines: Iterable[str]) -> Iterator[dict[str, str]]:
    """Parses a pipe-separated directory file, skipping its footer line."""
    rows = csv.DictReader(lines, delimiter="|")
    for row in rows:
        first = next(iter(row.values()), "") or ""
        if first.startswith("File Creation Time"):
            continue
        yield {key: (value or "").strip() for key, value in row.items()}


def clean_name(security_name: str, separator: bool = False) -> str:
    """Turns a security name into the company name people search for.

    "Alphabet Inc. - Class A Common Stock" becomes "Alphabet Inc. Class A",
    and "Coca-Cola Company (The) Common Stock" becomes
    "The Coca-Cola Company".

    Args:
        security_name: The name as the directory lists it.
        separator: True for Nasdaq names, which always put " - " between
            the company and the kind of security.
    """
    full = " ".join(security_name.split())
    name, security = full, ""
    if separator and " - " in full:
        name, security = full.split(" - ", 1)
    match = _SECURITY_SUFFIX.search(name)
    if match:
        security = f"{match.group(0)} {security}"
        name = name[: match.start()]
    name = name.rstrip(" -,")
    if not name:  # The whole name was the security type: keep it as is.
        return full
    if name.endswith(" (The)"):
        name = "The " + name.removesuffix(" (The)")
    label = _SHARE_LABEL.search(security)
    if label:
        name = f"{name} {label.group(1).title()} {label.group(2).upper()}"
    return name


def is_company_share(symbol: str, security_name: str) -> bool:
    """Whether a listing is a company's shares rather than another security."""
    if not re.fullmatch(r"[A-Z]{1,5}(\.[A-Z])?", symbol):
        return False  # $ marks preferred, = units, ^ rights and so on.
    if _NOT_SHARES.search(security_name) and not _COMMON_UNITS.search(
        security_name
    ):
        return False
    return True


def nasdaq_companies(lines: Iterable[str]) -> Iterator[tuple[str, str, str, int]]:
    """Company rows from nasdaqlisted.txt."""
    for row in read_rows(lines):
        symbol, name = row.get("Symbol", ""), row.get("Security Name", "")
        if row.get("Test Issue") != "N" or row.get("ETF") != "N":
            continue
        if not is_company_share(symbol, name):
            continue
        tier = NASDAQ_TIERS.get(row.get("Market Category", ""), 2)
        yield symbol.replace(".", "-"), clean_name(name, True), "NASDAQ", tier


def nyse_companies(lines: Iterable[str]) -> Iterator[tuple[str, str, str, int]]:
    """Company rows from otherlisted.txt, NYSE only (exchange code N)."""
    for row in read_rows(lines):
        symbol, name = row.get("ACT Symbol", ""), row.get("Security Name", "")
        if row.get("Exchange") != "N":
            continue
        if row.get("Test Issue") != "N" or row.get("ETF") != "N":
            continue
        if not is_company_share(symbol, name):
            continue
        yield symbol.replace(".", "-"), clean_name(name), "NYSE", 0


def _read(source: str) -> list[str]:
    if source.startswith("https://"):
        request = urllib.request.Request(
            source, headers={"User-Agent": "TickerLens company list builder"}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read().decode("utf-8", errors="replace").splitlines()
    return Path(source).read_text(encoding="utf-8").splitlines()


def main(argv: list[str]) -> None:
    """Downloads (or reads) both directory files and writes the CSV."""
    nasdaq_source = argv[1] if len(argv) > 1 else SOURCE.format("nasdaqlisted")
    other_source = argv[2] if len(argv) > 2 else SOURCE.format("otherlisted")
    companies = {}
    for row in nasdaq_companies(_read(nasdaq_source)):
        companies[row[0]] = row
    for row in nyse_companies(_read(other_source)):
        companies.setdefault(row[0], row)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(["ticker", "name", "exchange", "size_tier"])
        writer.writerows(sorted(companies.values()))
    print(f"Wrote {len(companies)} companies to {OUTPUT}")


if __name__ == "__main__":
    main(sys.argv)
