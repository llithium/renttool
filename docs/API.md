# API Reference

The app ships six serverless `GET` endpoints under `/api/*` ([src/routes/api/](../src/routes/api/)).
They provide a stable client contract over keyless and bundled data sources.

**Conventions**

- All endpoints are `GET` and return JSON.
- Bad/missing **required** params return **HTTP 400**, except autocomplete queries shorter
  than two characters, which return an empty list (`{ "message": "…" }`). Every other
  failure — upstream down or not found — returns **HTTP 200** with an `ok: false`
  (or empty-result) body, so the client can degrade gracefully instead of throwing.
- FIPS params are strings: `state` is 2 digits, `county` is 3 digits.
- Responses set `Cache-Control` for CDN/edge caching (durations noted per endpoint).

Typical call order for a city outside the bundled Apartment List snapshot:
`city-suggest` → (pick gives coords) → `geocode` (coords → FIPS) → `fmr`.
Snapshot cities use their bundled city-level estimates and skip the geocode/FMR calls.
When a restored snapshot city lacks a curated coordinate, the client calls `coordinates`
with its exact city/state identity. The complete places dataset remains server-only.

---

## GET `/api/city-suggest`

City autocomplete, proxied over [Photon](https://photon.komoot.io) (keyless OSM typeahead).
Filtered to US cities/towns/villages; each result carries coordinates so a pick can populate
the map without a second geocode call.

**Query params**

| Param | Required | Description                                                                          |
| ----- | -------- | ------------------------------------------------------------------------------------ |
| `q`   | no       | Search text, at most 100 chars. Missing or fewer than 2 chars returns an empty list. |

**Response** `200`

```json
{
  "suggestions": [
    { "label": "Tampa, FL", "city": "Tampa", "state": "FL", "lat": 27.9477, "lng": -82.4584 }
  ]
}
```

Up to 8 de-duplicated suggestions. Any upstream failure returns `{ "suggestions": [] }`.
Cache: `max-age=60, s-maxage=300`.

**Production abuse control**

The published Vercel Firewall rule `city-autocomplete-throttle` protects this public proxy
before the request reaches the serverless handler:

| Setting        | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Match          | Request Path equals `/api/city-suggest`                                |
| Counting key   | Client IP address only                                                 |
| Algorithm      | Fixed Window                                                           |
| Window / limit | 60 seconds / 100 requests per IP                                       |
| Action         | `429 Too Many Requests`                                                |
| Observability  | Vercel Dashboard → Firewall → overview and the rule's traffic grouping |

The 100-request window accommodates normal 220 ms typeahead bursts while capping sustained
traffic. Vercel owns the edge response and retry timing; the application does not maintain a
process-local counter or log raw IP addresses or search terms. The client treats a throttled
response like any unavailable remote refinement: it keeps bundled seed suggestions, does not
retry automatically, and leaves the existing polite loading/status behavior intact.

**Example**

```bash
curl "http://localhost:5173/api/city-suggest?q=tampa"
```

---

## GET `/api/geocode`

Resolves county/state FIPS from coordinates via the [FCC Area API](https://geo.fcc.gov/api/census/area)
(keyless). The FMR endpoint needs FIPS; the client already has coords from the autocomplete pick.

**Query params**

| Param | Required | Description |
| ----- | -------- | ----------- |
| `lat` | yes      | Latitude    |
| `lng` | yes      | Longitude   |

Missing, non-finite, or out-of-range `lat`/`lng` → **400**.

**Response** `200`

```json
{
  "ok": true,
  "stateFips": "12",
  "countyFips": "057",
  "combinedFips": "12057",
  "county": "Hillsborough County",
  "state": "FL"
}
```

On any upstream failure: `{ "ok": false }`. Cache: `max-age=86400, s-maxage=604800`.

**Example**

```bash
curl "http://localhost:5173/api/geocode?lat=27.9477&lng=-82.4584"
```

---

## GET `/api/coordinates`

Returns coordinates for an exact city/state match from the bundled SimpleMaps places
dataset. This is the fallback for restored rent cities that do not already carry curated
coordinates; it keeps the full places table out of the browser build.

**Query params**

| Param   | Required | Description                                      |
| ------- | -------- | ------------------------------------------------ |
| `city`  | yes      | Exact city name, 1–80 characters                 |
| `state` | yes      | Two-letter state abbreviation (case-insensitive) |

Missing or malformed identity → **400**.

**Response** `200`

```json
{ "ok": true, "lat": 42.7142, "lng": -84.5601 }
```

No exact bundled match returns `{ "ok": false }`.
Cache: `max-age=86400, s-maxage=2592000` (30d).

**Example**

```bash
curl "http://localhost:5173/api/coordinates?city=Lansing&state=MI"
```

---

## GET `/api/fmr`

HUD Fair Market Rents (40th-percentile) for a county, served only from the annual bundled
county table ([src/lib/data/fmr-county.json](../src/lib/data/fmr-county.json), generated by
[scripts/build-fmr-data.py](../scripts/build-fmr-data.py)). The endpoint makes no runtime HUD
request and requires no key. New England town-level rows are averaged during generation.

**Query params**

| Param    | Required | Description         |
| -------- | -------- | ------------------- |
| `state`  | yes      | 2-digit state FIPS  |
| `county` | yes      | 3-digit county FIPS |

Malformed FIPS → **400**.

**Response** `200`

```json
{ "ok": true, "r1": 1696, "r2": 1977, "county": "", "year": "FY2026", "bundled": true }
```

| Field       | Meaning                                            |
| ----------- | -------------------------------------------------- |
| `r1` / `r2` | 1BR / 2BR Fair Market Rent (USD/mo)                |
| `county`    | County name (empty when served from the bundle)    |
| `year`      | Fiscal year of the figures                         |
| `bundled`   | Always `true`; retained for response compatibility |

County not found in the bundle: `{ "ok": false, "reason": "not-found" }`.
Cache: `max-age=86400, s-maxage=2592000` (30d).

**Example**

```bash
curl "http://localhost:5173/api/fmr?state=12&county=057"
```

---

## GET `/api/nearby`

Returns nearby towns and suburbs from the bundled SimpleMaps places dataset. Results include
coordinates, rounded distance, and population so they can be selected without another search.
The endpoint returns up to eight places within 25 miles, ordered by population descending
and then distance. It excludes the named origin and places less than 0.75 miles away.

**Query params**

| Param   | Required | Description                              |
| ------- | -------- | ---------------------------------------- |
| `lat`   | yes      | Latitude                                 |
| `lng`   | yes      | Longitude                                |
| `city`  | no       | Origin city to exclude from results      |
| `state` | no       | Two-letter origin state used with `city` |

Invalid coordinates → **400**.

**Response** `200`

```json
{
  "nearby": [
    {
      "label": "Temple Terrace, FL",
      "city": "Temple Terrace",
      "state": "FL",
      "lat": 28.0353,
      "lng": -82.3893,
      "miles": 8,
      "pop": 26782
    }
  ]
}
```

Cache: `max-age=86400, s-maxage=2592000` (30d).

**Example**

```bash
curl "http://localhost:5173/api/nearby?lat=27.9477&lng=-82.4584&city=Tampa&state=FL"
```

---

## GET `/api/population`

Returns the population value of the nearest place within 10 miles from the bundled SimpleMaps
places dataset. This preserves the source's population definition; it does not infer metropolitan
geography from the size of the number.

**Query params**

| Param | Required | Description |
| ----- | -------- | ----------- |
| `lat` | yes      | Latitude    |
| `lng` | yes      | Longitude   |

Invalid coordinates → **400**.

**Response** `200`

```json
{ "ok": true, "pop": 384959, "name": "Tampa", "source": "simplemaps" }
```

No place within 10 miles returns `{ "ok": false }`.
Cache: `max-age=86400, s-maxage=2592000` (30d).

**Example**

```bash
curl "http://localhost:5173/api/population?lat=27.9477&lng=-82.4584"
```
