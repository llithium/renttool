from __future__ import annotations

import csv
import importlib.util
import json
import sys
import shutil
import tempfile
import unittest
import zipfile
from unittest.mock import patch
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(ROOT / "scripts"))


def load_script(module_name: str, filename: str):
    path = ROOT / "scripts" / filename
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


apartment = load_script("build_apartment_list_data", "build-apartment-list-data.py")
acs = load_script("build_acs_city_data", "build-acs-city-data.py")
fmr = load_script("build_fmr_data", "build-fmr-data.py")
updater = load_script("update_data", "update-data.py")


class ApartmentListBuilderTests(unittest.TestCase):
    def setUp(self) -> None:
        with (FIXTURES / "apartment-list-rents.csv").open(newline="", encoding="utf-8") as source:
            reader = csv.DictReader(source)
            self.fieldnames = reader.fieldnames or []
            self.rows = list(reader)

    def test_latest_period_aliases_and_row_filters(self) -> None:
        payload = apartment.build_payload(self.fieldnames, self.rows, minimum_cities=5)

        self.assertEqual(
            payload["meta"],
            {
                "source": "Apartment List Rent Estimates",
                "period": "2025_07",
                "label": "July 2025",
                "dataUrl": "https://www.apartmentlist.com/research/category/data-rent-estimates",
                "termsUrl": "https://www.apartmentlist.com/about/terms",
            },
        )
        cities = payload["cities"]
        self.assertEqual(
            set(cities),
            {"Alpha, ZZ", "New York, NY", "St Louis, MO", "St Petersburg, FL", "Winston Salem, NC"},
        )
        self.assertEqual(cities["New York, NY"], {"r1": 2300, "r2": 3000, "yoy": 9.5, "population": 100000})
        self.assertEqual(cities["St Louis, MO"]["yoy"], 18.2)
        self.assertEqual(cities["St Petersburg, FL"]["yoy"], 12.5)
        self.assertEqual(cities["Winston Salem, NC"]["yoy"], 10.5)
        self.assertNotIn("Only One, ZZ", cities)
        self.assertNotIn("Missing Bed, ZZ", cities)

    def test_explicit_period_changes_values_and_yoy(self) -> None:
        payload = apartment.build_payload(
            self.fieldnames,
            self.rows,
            period="2025_06",
            minimum_cities=5,
        )

        self.assertEqual(payload["meta"]["period"], "2025_06")
        self.assertEqual(payload["meta"]["label"], "June 2025")
        self.assertEqual(
            payload["cities"]["New York, NY"],
            {"r1": 2200, "r2": 2900, "yoy": 10.0, "population": 100000},
        )

    def test_invalid_and_non_positive_rents_are_rejected(self) -> None:
        for value in ("not-a-number", "0", "-20"):
            rows = [row.copy() for row in self.rows]
            rows[0]["2025_07"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                apartment.build_payload(self.fieldnames, rows, minimum_cities=5)

    def test_missing_prior_period_fails_before_building(self) -> None:
        with self.assertRaisesRegex(ValueError, "Prior-year period '2023_07'"):
            apartment.build_payload(self.fieldnames, self.rows, period="2024_07", minimum_cities=0)

    def test_default_city_guard_remains_fail_closed(self) -> None:
        with self.assertRaisesRegex(ValueError, "expected at least 600"):
            apartment.build_payload(self.fieldnames, self.rows)

    def test_conflicting_duplicate_city_bed_rows_are_rejected(self) -> None:
        rows = [row.copy() for row in self.rows]
        rows.append(rows[0] | {"2025_07": "9999"})
        with self.assertRaisesRegex(ValueError, "conflicting duplicate row"):
            apartment.build_payload(self.fieldnames, rows, minimum_cities=5)

    def test_missing_population_is_rejected_explicitly(self) -> None:
        rows = [row.copy() for row in self.rows]
        rows[0]["population"] = ""
        with self.assertRaisesRegex(ValueError, "missing population"):
            apartment.build_payload(self.fieldnames, rows, minimum_cities=5)

    def test_invalid_population_values_are_rejected(self) -> None:
        for value in ("-1", "NaN", "Infinity"):
            rows = [row.copy() for row in self.rows]
            rows[0]["population"] = value
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "population"):
                apartment.build_payload(self.fieldnames, rows, minimum_cities=5)

    def test_discovers_the_historic_csv_from_next_data(self) -> None:
        payload = {
            "props": {
                "pageProps": {
                    "downloadableAssets": [
                        {
                            "label": "Current Month Summary",
                            "url": "//assets.ctfassets.net/example/Apartment_List_Rent_Estimates_Summary_2026_08.csv",
                        },
                        {
                            "label": "Historic Rent Estimates (Jan 2017 - Present)",
                            "url": "//assets.ctfassets.net/example/Apartment_List_Rent_Estimates_2026_08.csv",
                        },
                    ]
                }
            }
        }
        page = f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(payload)}</script>'

        self.assertEqual(
            apartment.discover_source_url(page),
            "https://assets.ctfassets.net/example/Apartment_List_Rent_Estimates_2026_08.csv",
        )

    def test_rejects_an_unexpected_download_host(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unexpected Apartment List source URL"):
            apartment.validate_source_url(
                "https://example.com/Apartment_List_Rent_Estimates_2026_08.csv"
            )


class AcsBuilderTests(unittest.TestCase):
    @staticmethod
    def table_paths() -> dict[str, Path]:
        return {
            table: FIXTURES / f"acsdt5y2024-{table.lower()}.dat"
            for table in acs.TABLES
        }

    @staticmethod
    def targets() -> dict[str, str]:
        names = ("Athens, GA", "Watertown Town, MA", "St Louis, MO")
        return {acs.normalize(name): name for name in names}

    def test_suffix_and_alias_normalization(self) -> None:
        self.assertEqual(
            acs.city_key("Athens-Clarke County unified government (balance)", "GA"),
            acs.normalize("Athens, GA"),
        )
        self.assertEqual(
            acs.city_key("Watertown town", "MA"),
            acs.normalize("Watertown Town, MA"),
        )
        self.assertEqual(
            acs.city_key("St. Louis city", "MO"),
            acs.normalize("St Louis, MO"),
        )

    def test_read_table_handles_negative_missing_and_non_place_values(self) -> None:
        values = acs.read_table(
            self.table_paths()["B19013"],
            ("B19013_E001",),
        )

        self.assertIsNone(values["0000002"]["B19013_E001"])
        self.assertIsNone(values["0000003"]["B19013_E001"])
        self.assertNotIn("0400000US13", values)
        self.assertEqual(acs.percent(40, 100), 40.0)
        self.assertEqual(acs.percent(-1, 100), None)
        self.assertEqual(acs.percent(1, 0), None)

    def test_build_matches_canonical_targets_and_calculates_metrics(self) -> None:
        places = acs.read_places(FIXTURES / "2024_Gaz_place_national.txt", minimum_places=3)
        self.assertEqual(places["0000001"], ("Athens-Clarke County unified government (balance)", "GA"))

        payload = acs.build(
            2024,
            self.targets(),
            self.table_paths(),
            FIXTURES / "2024_Gaz_place_national.txt",
            minimum_matches=1,
            minimum_places=0,
        )

        self.assertEqual(
            payload["meta"],
            {
                "source": "U.S. Census Bureau American Community Survey",
                "year": 2024,
                "label": "2020–2024 ACS 5-year estimates",
                "geography": "Census place",
                "dataUrl": "https://www.census.gov/programs-surveys/acs/data/summary-file/2024.html",
            },
        )
        self.assertEqual(
            payload["cities"],
            {
                "Athens, GA": {
                    "population": 1000,
                    "householdIncome": 50000,
                    "commuteMinutes": 15.0,
                    "renterShare": 40.0,
                    "rentalVacancy": 8.7,
                }
            },
        )

    def test_default_match_guard_remains_fail_closed(self) -> None:
        with self.assertRaisesRegex(ValueError, "matched 1 of 3 cities"):
            acs.build(
                2024,
                self.targets(),
                self.table_paths(),
                FIXTURES / "2024_Gaz_place_national.txt",
                minimum_places=0,
            )

    def test_optional_missing_facts_remain_null_and_measured_zero_stays_zero(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = self.table_paths()
            copied = {}
            for table, source in paths.items():
                destination = root / source.name
                shutil.copy(source, destination)
                copied[table] = destination
            commute_text = copied["B08013"].read_text()
            copied["B08013"].write_text(commute_text.replace("0000001|600", "0000001|0"))
            vacancy_text = copied["B25004"].read_text()
            copied["B25004"].write_text(vacancy_text.replace("1600000US0000001|4|2\n", ""))
            payload = acs.build(
                2024,
                {acs.normalize("Athens, GA"): "Athens, GA"},
                copied,
                FIXTURES / "2024_Gaz_place_national.txt",
                minimum_matches=1,
                minimum_places=0,
            )
            self.assertEqual(payload["cities"]["Athens, GA"]["commuteMinutes"], 0.0)
            self.assertIsNone(payload["cities"]["Athens, GA"]["rentalVacancy"])


class FmrBuilderTests(unittest.TestCase):
    def test_non_default_year_requires_explicit_source(self) -> None:
        with patch.object(sys, "argv", ["build-fmr-data.py", "--year", "FY2027"]):
            with self.assertRaisesRegex(ValueError, "explicit --url or --input"):
                fmr.validate_args(fmr.parse_args())

    def test_hud_url_year_must_match_label(self) -> None:
        with patch.object(
            sys,
            "argv",
            [
                "build-fmr-data.py",
                "--year",
                "FY2027",
                "--url",
                "https://www.huduser.gov/FY26_FMRs.xlsx",
            ],
        ):
            with self.assertRaisesRegex(ValueError, "does not match"):
                fmr.validate_args(fmr.parse_args())

    def test_col_index_edge_cases(self) -> None:
        self.assertEqual(fmr.col_index("A1"), 0)
        self.assertEqual(fmr.col_index("Z7"), 25)
        self.assertEqual(fmr.col_index("AA1"), 26)
        self.assertEqual(fmr.col_index("AZ1"), 51)
        self.assertEqual(fmr.col_index("BA1"), 52)

    def make_fixture_xlsx(self, directory: Path) -> Path:
        path = directory / "fmr-minimal.xlsx"
        with zipfile.ZipFile(path, "w") as archive:
            archive.write(FIXTURES / "fmr-minimal-sharedStrings.xml", "xl/sharedStrings.xml")
            archive.write(FIXTURES / "fmr-minimal-sheet1.xml", "xl/worksheets/sheet1.xml")
        return path

    def test_read_rows_and_build_payload_group_and_filter_rows(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            rows = list(fmr.read_rows(self.make_fixture_xlsx(Path(directory))))

        self.assertEqual(rows[0], {0: "fips", 1: "fmr_1", 2: "fmr_2"})
        self.assertEqual(rows[1], {0: "2500101", 1: "1000", 2: "1200"})

        payload = fmr.build_payload(rows, "FY2027", minimum_counties=2)
        self.assertEqual(payload["meta"], {"year": "FY2027", "source": "HUD Fair Market Rents"})
        self.assertEqual(payload["counties"], {"25001": [1100, 1300], "36001": [900, 1000]})

    def test_default_county_guard_remains_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            rows = list(fmr.read_rows(self.make_fixture_xlsx(Path(directory))))

        with self.assertRaisesRegex(ValueError, "expected at least 3000"):
            fmr.build_payload(rows, "FY2027")


class MaintenanceCommandTests(unittest.TestCase):
    def test_atomic_writers_preserve_existing_bundle_when_replace_fails(self) -> None:
        payload = {"meta": {"year": 2027}, "cities": {"Example, ZZ": {}}}
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "snapshot.json"
            original = '{"original":true}\n'
            output.write_text(original, encoding="utf-8")
            from data_output import write_json_atomically

            with patch("data_output.os.replace", side_effect=OSError("disk full")):
                with self.assertRaisesRegex(OSError, "disk full"):
                    write_json_atomically(output, payload)
            self.assertEqual(output.read_text(encoding="utf-8"), original)
            self.assertEqual(list(output.parent.iterdir()), [output])

            with self.assertRaises(TypeError):
                write_json_atomically(output, {"bad": object()})
            self.assertEqual(list(output.parent.iterdir()), [output])

    def test_updater_rechecks_exact_membership_after_rebuild(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rent = root / "rent.json"
            acs_path = root / "acs.json"
            rent.write_text(json.dumps({"cities": {"A, ZZ": {}}}), encoding="utf-8")
            acs_path.write_text(json.dumps({"cities": {"B, ZZ": {}}}), encoding="utf-8")
            with patch.object(updater, "RENT", rent), patch.object(updater, "ACS", acs_path):
                with self.assertRaisesRegex(RuntimeError, "missing: A, ZZ"):
                    updater.require_aligned_membership()
            acs_path.write_text(json.dumps({"cities": {"A, ZZ": {}}}), encoding="utf-8")
            with patch.object(updater, "RENT", rent), patch.object(updater, "ACS", acs_path):
                updater.require_aligned_membership()

    def test_updater_command_reports_failed_and_repaired_rebuilds(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rent = root / "rent.json"
            acs_path = root / "acs.json"
            rent.write_text(json.dumps({"cities": {"A, ZZ": {}}}), encoding="utf-8")
            acs_path.write_text(
                json.dumps({"meta": {"year": 2024}, "cities": {"B, ZZ": {}}}),
                encoding="utf-8",
            )
            with patch.object(updater, "RENT", rent), patch.object(updater, "ACS", acs_path):
                with patch.object(updater, "run"), patch.object(updater.sys, "argv", ["update-data.py"]):
                    with self.assertRaisesRegex(RuntimeError, "missing: A, ZZ"):
                        updater.main()

                def rebuild(*arguments: str) -> None:
                    if "build-acs-city-data.py" in " ".join(arguments):
                        acs_path.write_text(
                            json.dumps({"meta": {"year": 2024}, "cities": {"A, ZZ": {}}}),
                            encoding="utf-8",
                        )

                with patch.object(
                    updater, "run", side_effect=rebuild
                ), patch.object(updater.sys, "argv", ["update-data.py"]):
                    updater.main()


if __name__ == "__main__":
    unittest.main()
