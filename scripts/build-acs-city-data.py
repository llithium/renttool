#!/usr/bin/env python3
"""Build the bundled city-facts snapshot from official ACS bulk files.

The script downloads table-based 5-year ACS Summary Files and the matching
Census place Gazetteer. It does not use the Census API or require an API key.

Usage:
  python3 scripts/build-acs-city-data.py --year 2024
  python3 scripts/build-acs-city-data.py --year 2024 --source-dir /path/to/files

When --source-dir is supplied, it must contain the six .dat files listed in
TABLES and the extracted national place Gazetteer text file. Downloaded source
files are temporary; only the compact generated JSON belongs in the repo.
"""

import argparse
import csv
import io
import json
import re
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RENT_INPUT = ROOT / "src" / "lib" / "data" / "apartment-list-rents.json"
OUT = ROOT / "src" / "lib" / "data" / "acs-city-facts.json"

TABLES = {
    "B01003": ("B01003_E001",),
    "B19013": ("B19013_E001",),
    "B25003": ("B25003_E001", "B25003_E003"),
    "B25004": ("B25004_E002", "B25004_E003"),
    "B08013": ("B08013_E001",),
    "B08301": ("B08301_E001", "B08301_E021"),
}

MIN_MATCHES = 600
MIN_PLACES = 25_000
PLACE_GEO_PREFIX = "1600000US"
SUFFIX_RE = re.compile(
    r"\s+(?:city(?: \(balance\))?|town|village|borough|municipality|CDP|city and borough|"
    r"consolidated government(?: \(balance\))?|metro(?:politan)? government(?: \(balance\))?|"
    r"urban county(?: government)?|unified government(?: \(balance\))?)$",
    re.IGNORECASE,
)

NAME_ALIASES = {
    "athens clarke county ga": "Athens, GA",
    "augusta richmond county ga": "Augusta, GA",
    "boise city id": "Boise, ID",
    "indianapolis in": "Indianapolis, IN",
    "lexington fayette ky": "Lexington, KY",
    "louisville jefferson county ky": "Louisville, KY",
    "nashville davidson tn": "Nashville, TN",
    "san buenaventura ventura ca": "Ventura, CA",
    "tysons va": "Tysons Corner, VA",
    "watertown ma": "Watertown Town, MA",
}


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, required=True, help="ACS release year, e.g. 2024")
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="directory of previously downloaded .dat and Gazetteer files",
    )
    return parser.parse_args()


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def city_key(name: str, state: str) -> str:
    raw = f"{SUFFIX_RE.sub('', name)}, {state}"
    key = normalize(raw)
    return normalize(NAME_ALIASES.get(key, raw))


def download(url: str, target: Path) -> None:
    print(f"Downloading {url.rsplit('/', 1)[-1]} …", flush=True)
    request = urllib.request.Request(url, headers={"User-Agent": "rent-tool-data-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def source_files(year: int, directory: Path) -> tuple[dict[str, Path], Path]:
    base = (
        f"https://www2.census.gov/programs-surveys/acs/summary_file/{year}/"
        f"table-based-SF/data/5YRData"
    )
    tables: dict[str, Path] = {}
    for table in TABLES:
        filename = f"acsdt5y{year}-{table.lower()}.dat"
        path = directory / filename
        if not path.exists():
            download(f"{base}/{filename}", path)
        tables[table] = path

    gazetteer = next(directory.glob(f"{year}_Gaz_place_national*.txt"), None)
    if gazetteer is None:
        archive = directory / f"{year}_Gaz_place_national.zip"
        if not archive.exists():
            download(
                f"https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
                f"{year}_Gazetteer/{archive.name}",
                archive,
            )
        with zipfile.ZipFile(archive) as zipped:
            member = next(name for name in zipped.namelist() if name.endswith(".txt"))
            zipped.extract(member, directory)
            gazetteer = directory / member
    return tables, gazetteer


def read_places(path: Path, minimum_places: int = MIN_PLACES) -> dict[str, tuple[str, str]]:
    places: dict[str, tuple[str, str]] = {}
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter="\t")
        for row in reader:
            geoid = (row.get("GEOID") or "").strip()
            name = (row.get("NAME") or "").strip()
            state = (row.get("USPS") or "").strip()
            if geoid and name and state:
                places[geoid] = (name, state)
    if len(places) < minimum_places:
        raise ValueError(f"Gazetteer contained only {len(places)} places")
    return places


def read_table(path: Path, columns: tuple[str, ...]) -> dict[str, dict[str, int]]:
    rows: dict[str, dict[str, int]] = {}
    with path.open(encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source, delimiter="|")
        for row in reader:
            geo_id = row.get("GEO_ID", "")
            if not geo_id.startswith(PLACE_GEO_PREFIX):
                continue
            values: dict[str, int] = {}
            for column in columns:
                raw = row.get(column, "")
                try:
                    value = int(raw)
                except (TypeError, ValueError):
                    value = -1
                values[column] = value if value >= 0 else 0
            rows[geo_id.removeprefix(PLACE_GEO_PREFIX)] = values
    return rows


def percent(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator * 100, 1) if numerator >= 0 and denominator > 0 else None


def main() -> None:
    options = args()
    if not RENT_INPUT.exists():
        raise FileNotFoundError(f"Bundled rent city list not found: {RENT_INPUT}")

    with RENT_INPUT.open(encoding="utf-8") as source:
        rent_cities = json.load(source)["cities"]
    targets = {normalize(name): name for name in rent_cities}

    if options.source_dir:
        options.source_dir.mkdir(parents=True, exist_ok=True)
        tables, gazetteer = source_files(options.year, options.source_dir)
        result = build(options.year, targets, tables, gazetteer)
    else:
        with tempfile.TemporaryDirectory(prefix="rent-tool-acs-") as temp:
            tables, gazetteer = source_files(options.year, Path(temp))
            result = build(options.year, targets, tables, gazetteer)

    OUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(
        f"Wrote {OUT} — {len(result['cities'])} cities "
        f"({OUT.stat().st_size / 1024:.0f} KB), ACS {options.year} 5-year",
        flush=True,
    )


def build(
    year: int,
    targets: dict[str, str],
    table_paths: dict[str, Path],
    gazetteer_path: Path,
    *,
    minimum_matches: int = MIN_MATCHES,
    minimum_places: int = MIN_PLACES,
) -> dict[str, object]:
    places = read_places(gazetteer_path, minimum_places)
    data = {table: read_table(table_paths[table], columns) for table, columns in TABLES.items()}

    cities: dict[str, dict[str, int | float]] = {}
    for geoid, (place_name, state) in places.items():
        canonical = targets.get(city_key(place_name, state))
        if canonical is None:
            continue
        try:
            population = data["B01003"][geoid]["B01003_E001"]
            income = data["B19013"][geoid]["B19013_E001"]
            occupied = data["B25003"][geoid]["B25003_E001"]
            renter = data["B25003"][geoid]["B25003_E003"]
            vacant_for_rent = data["B25004"][geoid]["B25004_E002"]
            rented_unoccupied = data["B25004"][geoid]["B25004_E003"]
            travel_minutes = data["B08013"][geoid]["B08013_E001"]
            workers = data["B08301"][geoid]["B08301_E001"]
            work_from_home = data["B08301"][geoid]["B08301_E021"]
        except KeyError:
            continue

        renter_share = percent(renter, occupied)
        vacancy_rate = percent(
            vacant_for_rent,
            renter + vacant_for_rent + rented_unoccupied,
        )
        commuters = workers - work_from_home
        commute = round(travel_minutes / commuters, 1) if travel_minutes > 0 and commuters > 0 else None
        if population <= 0 or income <= 0 or renter_share is None:
            continue
        cities[canonical] = {
            "population": population,
            "householdIncome": income,
            "commuteMinutes": commute or 0,
            "renterShare": renter_share,
            "rentalVacancy": vacancy_rate or 0,
        }

    if len(cities) < minimum_matches:
        missing = sorted(set(targets.values()) - set(cities))
        raise ValueError(
            f"Refusing to write incomplete data: matched {len(cities)} of {len(targets)} cities; "
            f"first missing: {', '.join(missing[:15])}"
        )

    return {
        "meta": {
            "source": "U.S. Census Bureau American Community Survey",
            "year": year,
            "label": f"{year - 4}–{year} ACS 5-year estimates",
            "geography": "Census place",
            "dataUrl": f"https://www.census.gov/programs-surveys/acs/data/summary-file/{year}.html",
        },
        "cities": dict(sorted(cities.items())),
    }


if __name__ == "__main__":
    main()
