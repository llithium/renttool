#!/usr/bin/env python3
"""Refresh bundled rent data and keep dependent city facts aligned."""

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "lib" / "data"
RENT = DATA / "apartment-list-rents.json"
ACS = DATA / "acs-city-facts.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero when rent data is stale or city-facts coverage is incomplete",
    )
    return parser.parse_args()


def load(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def city_names(snapshot: dict[str, object]) -> set[str]:
    cities = snapshot.get("cities", {})
    if not isinstance(cities, dict):
        raise ValueError("Data snapshot has no city map")
    return set(cities)


def run(*arguments: str) -> None:
    subprocess.run([sys.executable, *arguments], cwd=ROOT, check=True)


def main() -> None:
    options = parse_args()
    rent_builder = "scripts/build-apartment-list-data.py"
    run(rent_builder, *(["--check"] if options.check else []))

    rent = load(RENT)
    acs = load(ACS)
    rent_cities = city_names(rent)
    acs_cities = city_names(acs)
    if rent_cities == acs_cities:
        print(f"City-facts coverage is aligned — {len(rent_cities)} cities", flush=True)
        return

    missing = sorted(rent_cities - acs_cities)
    extra = sorted(acs_cities - rent_cities)
    if options.check:
        print(
            f"City-facts coverage is stale — {len(missing)} missing, {len(extra)} retired",
            flush=True,
        )
        raise SystemExit(1)

    meta = acs.get("meta", {})
    year = meta.get("year") if isinstance(meta, dict) else None
    if not isinstance(year, int):
        raise ValueError("ACS snapshot has no numeric release year")
    print(
        f"Rent city membership changed — rebuilding ACS {year} facts "
        f"({len(missing)} added, {len(extra)} retired) …",
        flush=True,
    )
    run("scripts/build-acs-city-data.py", "--year", str(year))


if __name__ == "__main__":
    main()
