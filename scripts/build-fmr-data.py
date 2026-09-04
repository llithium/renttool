#!/usr/bin/env python3
"""Build src/lib/data/fmr-county.json from HUD's county-level Fair Market Rents file.

Usage:
  python3 scripts/build-fmr-data.py
  python3 scripts/build-fmr-data.py --year FY2027 --url https://example/FY27_FMRs.xlsx
  python3 scripts/build-fmr-data.py --year FY2027 --input /path/to/FY27_FMRs.xlsx

With no arguments, downloads the currently bundled FY2026 file from huduser.gov (needs a browser
User-Agent — plain curl gets a 202 bot-challenge). Stdlib only; the xlsx is read
with zipfile + minimal XML parsing, no openpyxl required.

Rows are aggregated by the first 5 digits of the `fips` column (state+county FIPS);
New England has multiple town-level rows per county, which are averaged during generation.
Output maps FIPS -> [1BR, 2BR].

Re-run when HUD publishes or revises a fiscal year's county-level data.
"""

import argparse
import json
import re
import tempfile
import urllib.request
import zipfile
from collections.abc import Iterable
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree
from data_output import write_json_atomically

DEFAULT_YEAR = "FY2026"
DEFAULT_URL = "https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY26_FMRs.xlsx"
OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "data" / "fmr-county.json"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
MIN_COUNTIES = 3_000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--year",
        default=DEFAULT_YEAR,
        help=f"fiscal-year label stored in metadata (default: {DEFAULT_YEAR})",
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument(
        "--url",
        default=None,
        help=f"HUD county-level XLSX URL (default: {DEFAULT_URL})",
    )
    source.add_argument("--input", type=Path, help="local HUD county-level XLSX")
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> argparse.Namespace:
    if not re.fullmatch(r"FY\d{4}", args.year):
        raise ValueError("--year must use the FY#### format, for example FY2027")
    if args.year != DEFAULT_YEAR and args.url is None and args.input is None:
        raise ValueError("--year requires an explicit --url or --input source")
    if args.url is not None:
        match = re.search(r"/FY(\d{2,4})_FMRs\.xlsx$", args.url, re.IGNORECASE)
        if match:
            source_year = int(match.group(1))
            if source_year < 100:
                source_year += 2000
            if source_year != int(args.year[2:]):
                raise ValueError(f"HUD source URL year FY{source_year} does not match --year {args.year}")
    if args.input is not None and not args.input.is_file():
        raise FileNotFoundError(f"Input workbook not found: {args.input}")
    return args


def download(url: str, directory: Path) -> Path:
    dest = directory / url.rsplit("/", 1)[-1]
    print(f"Downloading {url} …")
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def col_index(cell_ref: str) -> int:
    """'C7' -> 2."""
    letters = re.match(r"[A-Z]+", cell_ref).group()
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


def read_rows(xlsx: Path):
    with zipfile.ZipFile(xlsx) as z:
        shared = [
            (t.text or "")
            for t in ElementTree.fromstring(z.read("xl/sharedStrings.xml")).iter(
                "{%s}t" % NS["m"]
            )
        ]
        sheet = ElementTree.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.iter("{%s}row" % NS["m"]):
            cells: dict[int, str] = {}
            for c in row.iter("{%s}c" % NS["m"]):
                v = c.find("{%s}v" % NS["m"])
                if v is None or v.text is None:
                    continue
                val = shared[int(v.text)] if c.get("t") == "s" else v.text
                cells[col_index(c.get("r"))] = val
            rows.append(cells)
        yield from rows


def aggregate_rows(rows: Iterable[dict[int, str]]) -> dict[str, list[int]]:
    rows = iter(rows)
    header = next(rows)
    col = {name: i for i, name in header.items()}
    fips_i, r1_i, r2_i = col["fips"], col["fmr_1"], col["fmr_2"]

    sums: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0])
    for cells in rows:
        fips = cells.get(fips_i, "")
        try:
            r1 = float(cells[r1_i])
            r2 = float(cells[r2_i])
        except (KeyError, ValueError):
            continue
        if len(fips) < 5 or r1 <= 0 or r2 <= 0:
            continue
        s = sums[fips[:5]]
        s[0] += r1
        s[1] += r2
        s[2] += 1

    counties = {
        fips: [round(s[0] / s[2]), round(s[1] / s[2])]
        for fips, s in sorted(sums.items())
    }

    return counties


def build_payload(
    rows: Iterable[dict[int, str]],
    year: str,
    minimum_counties: int = MIN_COUNTIES,
) -> dict[str, object]:
    counties = aggregate_rows(rows)
    if len(counties) < minimum_counties:
        raise ValueError(
            f"Refusing to write incomplete data: found {len(counties)} counties, "
            f"expected at least {minimum_counties}"
        )

    return {"meta": {"year": year, "source": "HUD Fair Market Rents"}, "counties": counties}


def main() -> None:
    args = validate_args(parse_args())
    if args.input is not None:
        payload = build_payload(read_rows(args.input), args.year)
    else:
        with tempfile.TemporaryDirectory(prefix="rent-tool-fmr-") as directory:
            xlsx = download(args.url or DEFAULT_URL, Path(directory))
            payload = build_payload(read_rows(xlsx), args.year)

    write_json_atomically(OUT, payload)
    print(f"Wrote {OUT} — {len(payload['counties'])} counties ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
