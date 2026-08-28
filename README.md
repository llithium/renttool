# Rent Tool

A SvelteKit web app: pick a city, enter an offered salary, and get your 30%-rule rent
budget, current rent estimates, city facts, an affordability map, take-home charts, and
pre-filtered apartment searches. The `/compare` view compares up to five cities with an
independent salary for each comparison entry.

Your city, salary, and comparison list sync to the URL, so any view is a shareable deep
link (the **Copy link** button copies it) that restores on reload or on another device.

Rebuilt from the original single-file `reference/rent-city-artifact.html` into a deployable
app with serverless endpoints for search and location lookups.

## Run locally

```bash
bun install
bun run dev        # http://localhost:5173
```

Other scripts: `bun run build` (production, adapter-vercel), `bun run preview`,
`bun run format` / `bun run format:check` (Prettier, with the Svelte and Tailwind plugins),
`bun run lint` / `bun run lint:fix` (ESLint flat config), `bun run check` (type-check),
`bun run test` (unit tests), and `bun run test:e2e` (browser/accessibility tests).
`bun run validate` runs the format check, lint, type-check, unit tests, and build in one go.
`bun run test:e2e` and `bun audit` are optional manual checks; the browser tests need a browser
download, and the audit needs network access.

## Styling

Tailwind CSS v4 through `@tailwindcss/vite`, with utilities written directly in the markup.
`src/app.css` holds only what utilities cannot express: the light/dark design tokens (raw
custom properties, republished as Tailwind theme tokens via `@theme inline` so a
`[data-theme]` flip re-colors the page at runtime), the entrance keyframes, and the
reduced-motion and focus-ring base rules. Two components keep a scoped `<style>` block for
the same reason — `SalarySlider` (range-input vendor pseudo-elements) and `RentMap`
(Leaflet's own DOM).

`eslint-plugin-better-tailwindcss` enforces class hygiene: no duplicate, conflicting,
unknown, deprecated, or non-canonical classes. Class ordering is left to
`prettier-plugin-tailwindcss`.

## Data sources

| Source                                      | Endpoint            | Key needed | Notes                                            |
| ------------------------------------------- | ------------------- | ---------- | ------------------------------------------------ |
| **Photon** (OSM)                            | `/api/city-suggest` | none       | City autocomplete + coordinates                  |
| **Apartment List Rent Estimates** (bundled) | none                | none       | Monthly city 1BR/2BR estimates                   |
| **Census ACS 5-year** (bundled)             | none                | none       | Structured facts for 651 Census places           |
| **FCC Area API**                            | `/api/geocode`      | none       | Coords → county FIPS                             |
| **HUD FMR** (bundled)                       | `/api/fmr`          | none       | FY2026 Fair Market Rents for **every US county** |
| **SimpleMaps places** (bundled)             | `/api/nearby`       | none       | Nearby towns/suburbs around a point              |
| **SimpleMaps places** (bundled)             | `/api/population`   | none       | Population for a coordinate                      |
| **SimpleMaps places** (bundled)             | `/api/coordinates`  | none       | Exact city/state coordinate fallback             |

The app **degrades gracefully** and needs **no keys at all**: 651 cities use the bundled
June 2026 Apartment List snapshot, and cities outside that snapshot resolve through the
bundled county-level HUD Fair Market Rents table
(`src/lib/data/fmr-county.json`, ~3,200 counties). HUD lookups require no runtime network
request or API key.

The UI identifies the statistic it is showing: Apartment List estimated median rent, or
HUD 40th-percentile Fair Market Rent. See
[docs/API.md](docs/API.md) for the full endpoint reference (params, responses, examples).

The full SimpleMaps places table stays server-side. Restored cities that lack a curated
coordinate use `/api/coordinates` for an exact city/state match, avoiding a roughly 1.25 MB
places-data chunk in the browser build while retaining bundled fallback coverage.

The City snapshot replaces editorial blurbs with consistently sourced Census-place facts:
population, median household income, mean commute, renter-occupied housing share, and
rental vacancy rate. Each snapshot shows its ACS vintage and geography in the UI.

### Apartment List data refresh and attribution

Download the current Rent Estimates CSV manually from the
[Apartment List data page](https://www.apartmentlist.com/research/category/data-rent-estimates),
then regenerate the bundled city snapshot:

```bash
python3 scripts/build-apartment-list-data.py /path/to/Apartment_List_Rent_Estimates_YYYY_MM.csv
# optionally select a particular month present in the file
python3 scripts/build-apartment-list-data.py /path/to/file.csv --period YYYY_MM
```

The generator keeps city-level 1BR/2BR estimates, calculates 1BR year-over-year change,
and refuses to write a snapshot with fewer than 600 cities. Do not commit the downloaded
source CSV; commit only `src/lib/data/apartment-list-rents.json` after running the test
commands below.

Data from Apartment List Rent Estimates, © Apartment List, Inc. Use of the data is subject
to the [Apartment List Terms of Service](https://www.apartmentlist.com/about/terms). This
deployment is intended for the maintainer's private, non-commercial use; review the terms
again before making it public or using it commercially. The app keeps this attribution in
its footer.

### Annual Census city-facts refresh

After the Census Bureau releases a new ACS 5-year Summary File, rebuild the city snapshot:

```bash
python3 scripts/build-acs-city-data.py --year 2025
```

The generator downloads six official table-based Summary Files plus the matching national
place Gazetteer into a temporary directory. It uses no API key and makes no runtime request
from the app. To retain or reuse the raw downloads locally, pass `--source-dir /path/to/acs`.
It refuses to write unless at least 600 Apartment List cities match Census places; review
the reported match count and sample values before committing
`src/lib/data/acs-city-facts.json`.

### Annual HUD data refresh

When HUD publishes or revises its county-level Fair Market Rent workbook, regenerate the
bundle with an explicit fiscal-year label and either the official URL or a downloaded file.
Get the county-level XLSX from the [official HUD FMR dataset page](https://www.huduser.gov/portal/datasets/fmr.html):

```bash
python3 scripts/build-fmr-data.py --year FY2027 --url https://www.huduser.gov/portal/datasets/fmr/fmr2027/FY27_FMRs.xlsx
# or
python3 scripts/build-fmr-data.py --year FY2027 --input /path/to/FY27_FMRs.xlsx
```

Running the script without arguments rebuilds the currently bundled FY2026 release. The
generator refuses to overwrite the bundle when fewer than 3,000 counties are parsed and
prints the final county count and file size. Review the metadata and sample counties, then run:

```bash
bun run check
bun run test
bun run build
bun run test:e2e
git add src/lib/data/fmr-county.json
```

Commit the regenerated JSON together with the fiscal-year documentation update.

## Structure

- `src/lib/data/` — bundled rent, ACS, and place data plus coordinates and tax tables
- `src/lib/` — city-aware estimated tax/budget math, formatting, search links, typed API client,
  `appState.svelte.ts` (the rent-plan workspace), `rentLookupCoordinator.ts` (shared coordinate
  and rent-request cancellation), `rentPlanPresentation.svelte.ts` (the presentation seam used by
  both planning routes), `planRepresentation.ts` (canonical shareable URL encoding),
  `urlSync.svelte.ts` (state ⇄ address bar), and `salaryField.svelte.ts` (the salary input's own
  state). The workspace keeps plan state, browser storage, canonicalization, and comparison-cap
  rules behind injected adapters; lookup coordination stays behind the same public workspace seam.
  URL synchronization uses SvelteKit shallow routing so canonical links and city-level Back/Forward
  history stay aligned with the client router.
- `src/lib/compare/` — the compare view's logic: `decision.ts` (comparison entries, metric view
  model, fit status, and decision briefs), `links.ts` (city navigation links), and
  `salaries.svelte.ts` (per-city salaries + persistence)
- `src/lib/components/ui/` — shared: Brand, CitySearch (autocomplete combobox), SalaryInput,
  SectionHeading, StatGrid, ThemeToggle
- `src/lib/components/city/` — the city view: CitySidebar (brand, search, salary, actions,
  BudgetCard), SalarySlider, CityActions, CityHeadline, Verdict, CityFacts, SearchLinks,
  NearbySuburbs, RentTrendChart, TaxBreakdownChart, ComparisonTable, RentMap (Leaflet),
  SourcesFooter
- `src/lib/components/compare/` — the compare view: ScenarioCard, CompareHighlights,
  CompareMetricsTable
- `src/routes/` — the rent-plan view (`/`), comparison view (`/compare`), privacy page, and terms
  page
- `src/routes/api/` — the six serverless endpoints above

The planning routes (`/` and `/compare`) are orchestration only: they use the rent-plan
presentation seam to wire state and intents to components, while owning the section rhythm (the
hairline between result sections and the staggered entrance). Components receive that rhythm
through a `class` prop rather than a `:global()` selector.

## Deploy

Push to a repo and import into Vercel (adapter-vercel is already configured), or run
`vercel`. No API keys are required for off-list HUD rent coverage.

This repository does not currently track a GitHub Actions workflow, so run the local checks
above as needed. The app targets Node 22 on Vercel.
