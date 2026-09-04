#!/usr/bin/env python3
"""Build the app's compact city rent snapshot from Apartment List estimates.

Usage:
  python3 scripts/build-apartment-list-data.py
  python3 scripts/build-apartment-list-data.py --check
  python3 scripts/build-apartment-list-data.py /path/to/Apartment_List_Rent_Estimates_YYYY_MM.csv
  python3 scripts/build-apartment-list-data.py /path/to/file.csv --period 2026_06

Without a local input, the script discovers and downloads the current historic Rent
Estimates CSV from Apartment List's public data page. It keeps only the selected
month's city-level 1BR/2BR estimates and calculates 1BR year-over-year change from
the same source file.
"""

import argparse
import csv
import json
import math
import re
import tempfile
import urllib.request
from collections import defaultdict
from collections.abc import Iterable
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from data_output import write_json_atomically

OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "data" / "apartment-list-rents.json"
DATA_PAGE_URL = "https://www.apartmentlist.com/research/category/data-rent-estimates"
ASSET_HOST = "assets.ctfassets.net"
PERIOD_RE = re.compile(r"^\d{4}_\d{2}$")
SOURCE_NAME_RE = re.compile(r"^Apartment_List_Rent_Estimates_(\d{4}_\d{2})\.csv$")
MIN_CITIES = 600

NAME_ALIASES = {
    "New York City, NY": "New York, NY",
    "St. Louis, MO": "St Louis, MO",
    "St. Petersburg, FL": "St Petersburg, FL",
    "Winston-Salem, NC": "Winston Salem, NC",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input",
        type=Path,
        nargs="?",
        help="local Apartment List CSV (default: discover and download the latest official file)",
    )
    parser.add_argument(
        "--period",
        help="month column to bundle in YYYY_MM format (default: latest available)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero instead of writing when the bundled snapshot is stale",
    )
    return parser.parse_args()


class NextDataParser(HTMLParser):
    """Extract Next.js's JSON payload without depending on its surrounding markup."""

    def __init__(self) -> None:
        super().__init__()
        self.capturing = False
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script" and dict(attrs).get("id") == "__NEXT_DATA__":
            self.capturing = True

    def handle_data(self, data: str) -> None:
        if self.capturing:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self.capturing:
            self.capturing = False


def validate_source_url(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    filename = Path(parsed.path).name
    match = SOURCE_NAME_RE.fullmatch(filename)
    if parsed.scheme != "https" or parsed.hostname != ASSET_HOST or match is None:
        raise ValueError(f"Unexpected Apartment List source URL: {url}")
    return url, match.group(1)


def historic_asset_urls(value: object) -> list[str]:
    """Find historic rent-estimate assets in the nested Next.js payload."""
    found: list[str] = []
    if isinstance(value, dict):
        assets = value.get("downloadableAssets")
        if isinstance(assets, list):
            for asset in assets:
                if not isinstance(asset, dict):
                    continue
                label = asset.get("label")
                url = asset.get("url")
                if (
                    isinstance(label, str)
                    and label.startswith("Historic Rent Estimates")
                    and isinstance(url, str)
                ):
                    found.append(urljoin(DATA_PAGE_URL, url))
        for child in value.values():
            found.extend(historic_asset_urls(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(historic_asset_urls(child))
    return found


def discover_source_url(page: str) -> str:
    parser = NextDataParser()
    parser.feed(page)
    if not parser.parts:
        raise ValueError("Apartment List data page did not contain a Next.js data payload")
    payload = json.loads("".join(parser.parts))
    candidates = [validate_source_url(url) for url in historic_asset_urls(payload)]
    if not candidates:
        raise ValueError("Apartment List data page did not list a historic Rent Estimates CSV")
    return max(candidates, key=lambda item: item[1])[0]


def request(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"User-Agent": "rent-tool-data-refresh/1.0"})


def download_latest(target: Path) -> str:
    print(f"Discovering the latest rent estimates from {DATA_PAGE_URL} …", flush=True)
    with urllib.request.urlopen(request(DATA_PAGE_URL), timeout=60) as response:
        source_url = discover_source_url(response.read().decode("utf-8"))
    print(f"Downloading {Path(urlparse(source_url).path).name} …", flush=True)
    with urllib.request.urlopen(request(source_url), timeout=120) as response, target.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    return source_url


def number(value: str) -> int:
    try:
        parsed_float = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"expected a numeric rent, got {value!r}") from error
    if not math.isfinite(parsed_float):
        raise ValueError(f"expected a finite rent, got {value!r}")
    parsed = round(parsed_float)
    if parsed <= 0:
        raise ValueError(f"expected a positive rent, got {value!r}")
    return parsed


def population(value: str | None, city: str) -> int:
    if value is None or not value.strip():
        raise ValueError(f"missing population for {city}")
    try:
        parsed_float = float(value)
    except ValueError as error:
        raise ValueError(f"invalid population for {city}: {value!r}") from error
    if not math.isfinite(parsed_float) or parsed_float <= 0:
        raise ValueError(f"population for {city} must be a positive finite number")
    return round(parsed_float)


def month_label(period: str) -> str:
    year, month = period.split("_")
    names = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    return f"{names[int(month) - 1]} {year}"


def select_period(fieldnames: list[str], requested: str | None = None) -> tuple[str, str]:
    periods = sorted(name for name in fieldnames if PERIOD_RE.fullmatch(name))
    if not periods:
        raise ValueError("CSV contains no YYYY_MM rent columns")
    period = requested or periods[-1]
    if period not in periods:
        raise ValueError(f"Period {period!r} is not present in the CSV")
    prior = f"{int(period[:4]) - 1}{period[4:]}"
    if prior not in periods:
        raise ValueError(f"Prior-year period {prior!r} is required to calculate YoY")
    return period, prior


def build_payload(
    fieldnames: list[str],
    rows: Iterable[dict[str, str]],
    period: str | None = None,
    minimum_cities: int = MIN_CITIES,
) -> dict[str, object]:
    period, prior = select_period(fieldnames, period)

    grouped: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    for row in rows:
        if row.get("location_type") != "City":
            continue
        location_name = row.get("location_name")
        bed_size = row.get("bed_size")
        if not location_name or not bed_size:
            continue
        name = NAME_ALIASES.get(location_name, location_name)
        previous = grouped[name].get(bed_size)
        if previous is not None and previous != row:
            raise ValueError(f"conflicting duplicate row for {name} / {bed_size}")
        grouped[name][bed_size] = row

    cities: dict[str, dict[str, int | float]] = {}
    for name, beds in sorted(grouped.items()):
        if "1br" not in beds or "2br" not in beds:
            continue
        one = beds["1br"]
        two = beds["2br"]
        r1 = number(one[period])
        r2 = number(two[period])
        prior_r1 = number(one[prior])
        city_population = population(one.get("population"), name)
        cities[name] = {
            "r1": r1,
            "r2": r2,
            "yoy": round((r1 / prior_r1 - 1) * 100, 1),
            "population": city_population,
        }

    if len(cities) < minimum_cities:
        raise ValueError(
            f"Refusing to write incomplete data: found {len(cities)} cities, "
            f"expected at least {minimum_cities}"
        )

    return {
        "meta": {
            "source": "Apartment List Rent Estimates",
            "period": period,
            "label": month_label(period),
            "dataUrl": DATA_PAGE_URL,
            "termsUrl": "https://www.apartmentlist.com/about/terms",
        },
        "cities": cities,
    }


def build_from_csv(path: Path, period: str | None = None) -> dict[str, object]:
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header")
        return build_payload(reader.fieldnames, reader, period)


def encoded(payload: dict[str, object]) -> str:
    return json.dumps(payload, separators=(",", ":")) + "\n"


def existing_summary() -> tuple[str, int]:
    if not OUT.exists():
        return "none", 0
    current = json.loads(OUT.read_text(encoding="utf-8"))
    return current.get("meta", {}).get("period", "unknown"), len(current.get("cities", {}))


def finish(payload: dict[str, object], check: bool) -> None:
    previous_period, previous_count = existing_summary()
    period = payload["meta"]["period"]
    city_count = len(payload["cities"])
    unchanged = OUT.exists() and OUT.read_text(encoding="utf-8") == encoded(payload)

    if check:
        if unchanged:
            print(f"Rent snapshot is current — {period}, {city_count} cities", flush=True)
            return
        print(
            f"Rent snapshot is stale — bundled {previous_period} ({previous_count} cities), "
            f"latest {period} ({city_count} cities)",
            flush=True,
        )
        raise SystemExit(1)

    if unchanged:
        print(f"No update needed — {period}, {city_count} cities", flush=True)
        return

    write_json_atomically(OUT, payload)
    print(
        f"Updated {OUT} — {previous_period} ({previous_count} cities) → "
        f"{period} ({city_count} cities, {OUT.stat().st_size / 1024:.0f} KB)",
        flush=True,
    )


def main() -> None:
    options = parse_args()
    if options.input is not None:
        if not options.input.is_file():
            raise FileNotFoundError(f"Input CSV not found: {options.input}")
        payload = build_from_csv(options.input, options.period)
    else:
        with tempfile.TemporaryDirectory(prefix="rent-tool-apartment-list-") as directory:
            source = Path(directory) / "rent-estimates.csv"
            source_url = download_latest(source)
            payload = build_from_csv(source, options.period)
            _, source_period = validate_source_url(source_url)
            if options.period is None and payload["meta"]["period"] != source_period:
                raise ValueError(
                    f"Source filename says {source_period}, but latest CSV period is "
                    f"{payload['meta']['period']}"
                )

    finish(payload, options.check)


if __name__ == "__main__":
    main()
