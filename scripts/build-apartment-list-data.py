#!/usr/bin/env python3
"""Build the app's compact city rent snapshot from a manually downloaded
Apartment List Rent Estimates CSV.

Usage:
  python3 scripts/build-apartment-list-data.py /path/to/Apartment_List_Rent_Estimates_YYYY_MM.csv
  python3 scripts/build-apartment-list-data.py /path/to/file.csv --period 2026_06

The source CSV must be downloaded manually from Apartment List. This script never
accesses apartmentlist.com. It keeps only the selected month's city-level 1BR/2BR
estimates and calculates 1BR year-over-year change from the same source file.
"""

import argparse
import csv
import json
import re
from collections.abc import Iterable
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "data" / "apartment-list-rents.json"
PERIOD_RE = re.compile(r"^\d{4}_\d{2}$")
MIN_CITIES = 600

NAME_ALIASES = {
    "New York City, NY": "New York, NY",
    "St. Louis, MO": "St Louis, MO",
    "St. Petersburg, FL": "St Petersburg, FL",
    "Winston-Salem, NC": "Winston Salem, NC",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="manually downloaded Apartment List CSV")
    parser.add_argument(
        "--period",
        help="month column to bundle in YYYY_MM format (default: latest available)",
    )
    return parser.parse_args()


def number(value: str) -> int:
    parsed = round(float(value))
    if parsed <= 0:
        raise ValueError(f"expected a positive rent, got {value!r}")
    return parsed


def month_label(period: str) -> str:
    year, month = period.split("_")
    names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
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
        population = int(float(one.get("population") or 0))
        cities[name] = {
            "r1": r1,
            "r2": r2,
            "yoy": round((r1 / prior_r1 - 1) * 100, 1),
            "population": population,
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
            "dataUrl": "https://www.apartmentlist.com/research/category/data-rent-estimates",
            "termsUrl": "https://www.apartmentlist.com/about/terms",
        },
        "cities": cities,
    }


def main() -> None:
    args = parse_args()
    if not args.input.is_file():
        raise FileNotFoundError(f"Input CSV not found: {args.input}")

    with args.input.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header")
        payload = build_payload(reader.fieldnames, reader, args.period)

    OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(
        f"Wrote {OUT} — {len(payload['cities'])} cities "
        f"({OUT.stat().st_size / 1024:.0f} KB), {payload['meta']['period']}"
    )


if __name__ == "__main__":
    main()
