# Rent Tool codebase audit

**Implementation update: September 4, 2026.** The cleanup ledger at the end records the changes made after approval. The findings and line numbers below describe the original audit baseline.

Audit date: September 3, 2026. Baseline: `1b596047816860ee17cf96eef1b919a237de9433`.

The repository has accumulated real cleanup debt, chiefly redundant interfaces, permissive data boundaries, leftover presentation contracts, and tests coupled to incidental details. It is not dominated by unfinished stubs or worthless tests. Most concurrency, URL restoration, comparison-salary, and spatial-lookup coverage protects meaningful behavior.

Three investigation subagents ran on **gpt-5.6-luna**: runtime/data/API modules; test value; and maintenance scripts. The primary agent reviewed Svelte components, routes, styles, configuration, documentation, and cross-cutting findings, checked callers, and reproduced selected edge cases. During the investigation, no application code or tests were changed; this report was the only added repository file. Implementation followed after user approval.

**Scope and evidence**

The inventory contained 144 tracked files, including 34 Svelte components/routes, 26 Vitest test files, one Playwright suite, four Python maintenance commands and their test module, TypeScript image-maintenance code, configuration, documentation, and bundled data. Runtime and maintenance source and test files were inspected. Generated datasets were checked through their consumers, schema, tests, and selected data probes; this was not a re-verification of every underlying rent, tax, image, or Census fact. The historical HTML reference is explicitly retained as a reference artifact, not classified as dead application code.

Validation at the audit baseline passed:

- Formatting, ESLint, and Svelte/TypeScript checks; zero Svelte diagnostics.
- 169 unit cases across 26 Vitest files.
- 14 Python data-builder cases.
- 27 Chromium end-to-end cases, including accessibility, history, comparisons, and map interaction.
- Production build.

No data or image refresh was run, and no provider quota was consumed by refresh commands. Passing tests do not invalidate the findings below: several concern untested input boundaries or cleanup rather than current happy-path failures.

Priority means **P1: fix before the affected maintenance workflow is trusted**, **P2: worthwhile correctness or maintainability work**, **P3: small cleanup to batch with related changes**. Static lifecycle risks are identified explicitly rather than represented as browser-reproduced failures.

## Dead code, wrappers, and redundant surfaces

**1. Unused Brand component — P3, confirmed dead.**

[Brand.svelte](/Users/nigel/Developer/renttool/src/lib/components/ui/Brand.svelte:1) has no imports or rendering callers. Its linked and unlinked branches survive although the active header renders navigation directly. README still lists it as shared UI.

Proposal: delete the component and update the inventory. Do not add a test asserting the file is gone. A build and the existing navigation coverage are sufficient.

**2. Unused factories, forwarding functions, and re-exports — P3, confirmed.**

- [createComparisonSet](/Users/nigel/Developer/renttool/src/lib/compare/comparisonSet.svelte.ts:352) has no callers; the workspace constructs `ComparisonSet` directly.
- [appendComparisonLinks](/Users/nigel/Developer/renttool/src/lib/compare/links.ts:45) has no callers and forwards to the canonical URL module.
- [metricNumber](/Users/nigel/Developer/renttool/src/lib/compare/decision.ts:305) has callers but does nothing beyond `definition.read(entry)`. Its name does not add a useful invariant.
- [decision.ts re-exports](/Users/nigel/Developer/renttool/src/lib/compare/decision.ts:10) retain salary-equivalence exports even though current callers import the owning module directly. [links.ts](/Users/nigel/Developer/renttool/src/lib/compare/links.ts:31) similarly re-exports salary-link helpers with no current consumers through that path.

Proposal: remove unused entry points/re-exports and inline `metricNumber`. Keep `cityHref`, which expresses a real navigation operation, and the actual serialization helpers. A function being short is not by itself a reason to delete it.

**3. Two snapshot interfaces maintained only for tests — P2, confirmed.**

[RentPlanWorkspace.snapshot](/Users/nigel/Developer/renttool/src/lib/appState.svelte.ts:186) constructs an aggregate state object. [RentPlanPresentation.snapshot](/Users/nigel/Developer/renttool/src/lib/rentPlanPresentation.svelte.ts:102) copies that into a second aggregate with renamed fields. Production routes and components read individual getters. The snapshot getters are otherwise used by tests.

This means adding a field can involve state, a getter, a snapshot type, snapshot construction, a presentation getter, another snapshot type, and another construction. The tests help keep this unused production surface alive.

Proposal: remove both snapshots and assert through the getters production uses. Keep the behavioral tests. Do not delete the whole presentation module: it also owns budget presentation, sharing, and explicit map-focus behavior. Consider a smaller presentation interface only after the redundant snapshots are gone.

**4. Test support lives in the production module — P3, confirmed.**

[createMemoryComparisonStorage](/Users/nigel/Developer/renttool/src/lib/compare/comparisonSet.svelte.ts:75) is used only by comparison-set tests. Its comment also advertises non-browser sessions, but there are no such production callers.

Proposal: move this adapter to a test helper or the test file. Keep dependency injection and storage-failure tests. Other exports used to test real calculations, such as federal tax, are not automatically equivalent to this test-only helper.

**5. Unused options and data fields — P3, confirmed with different cleanup choices.**

- [CityActions.canShare](/Users/nigel/Developer/renttool/src/lib/components/city/CityActions.svelte:7) is always passed `true` by its sole [caller](/Users/nigel/Developer/renttool/src/lib/components/city/CitySidebar.svelte:63). Remove the prop and unreachable disabled state.
- [SectionHeading.level](/Users/nigel/Developer/renttool/src/lib/components/ui/SectionHeading.svelte:13) has no current `h3` caller. Remove the speculative variation unless there is a concrete near-term use.
- [LandingContent.root](/Users/nigel/Developer/renttool/src/lib/components/landing/LandingContent.svelte:7) is assigned by `bind:this` but never read. Here the better fix is to use it to scope GSAP, not simply delete it; see finding 15.
- [--container-page](/Users/nigel/Developer/renttool/src/app.css:141) has no application utility consumer, and its comment describes a page width the main routes no longer use.
- [Budget.taxAssumptions](/Users/nigel/Developer/renttool/src/lib/budget.ts:149) is produced but never consumed; UI assumptions are separately written in components. Prefer actually consuming a shared assumptions representation or removing the unused field.
- [ComparisonRent.twoBedroom](/Users/nigel/Developer/renttool/src/lib/compare/decision.ts:372) duplicates the rent2 metric and has no field consumer. Remove this unused projection.

These are individually small; their significance is the repeated pattern of keeping old branches and interfaces after callers change.

## TypeScript and data-model problems

There is little evidence of Python syntax mechanically translated into TypeScript. The relevant smell is **dynamic-data habits in a statically typed codebase**: casts substituting for validation, strings serving as structured records, duplicated key lists, and flexible inputs supported solely because old tests still construct them.

**6. URL adapter accepts several internal shapes without production demand — P2.**

[compare/links.ts](/Users/nigel/Developer/renttool/src/lib/compare/links.ts:16) accepts committed entries, bare city objects with optional salaries, and nested city objects with optional salaries. `representationEntries` branches on `'city' in input`. The production comparison route supplies complete committed entries; [tests](/Users/nigel/Developer/renttool/src/lib/compare/links.test.ts:13) exercise the extra bare-city forms.

Proposal: narrow this internal function to the actual production entry shape and simplify conversion. Keep backward-compatible URL parsing in `planRepresentation`; changing an internal adapter does not require breaking old shared links. This is a useful distinction between real compatibility and speculative flexibility.

**7. Static metric definitions are reconstructed and validated at runtime — P2.**

[decision.ts](/Users/nigel/Developer/renttool/src/lib/compare/decision.ts:20) separately defines `METRIC_KEYS` and a metric-definition array. [completeMetricRecord](/Users/nigel/Developer/renttool/src/lib/compare/decision.ts:333) then checks for duplicate/missing keys every time it builds an entry. [criterion lookup](/Users/nigel/Developer/renttool/src/lib/compare/decision.ts:487) searches an array and throws for fixed hard-coded keys.

Proposal: define keyed metric/criterion records with `satisfies`, derive key types from them, and retain a small explicit order list if needed for presentation. Then remove bookkeeping whose only job is to reconcile two hand-maintained declarations. Keep runtime handling of genuinely absent rent/financial data. At five comparison entries this is principally clarity, not a performance emergency.

**8. Repeated salary validation disagrees about the invariant — P2, reproduced.**

[isValidCommittedSalary](/Users/nigel/Developer/renttool/src/lib/compare/comparisonSet.svelte.ts:48) accepts any finite number greater than zero. [setSalary](/Users/nigel/Developer/renttool/src/lib/compare/comparisonSet.svelte.ts:232) then rounds it. A local execution against the actual Svelte-compiled module accepted `0.1` and stored `0`. The workspace has the same validate-before-round pattern at [appState.svelte.ts:202](/Users/nigel/Developer/renttool/src/lib/appState.svelte.ts:202), while [URL salary normalization](/Users/nigel/Developer/renttool/src/lib/planRepresentation.ts:81) rechecks the rounded result.

The ordinary text input normally emits integer salaries, so this is a programmatic/restoration boundary defect rather than a demonstrated common typing failure.

Proposal: one numeric normalization function should round and then validate the committed value. Keep text shorthand parsing and field-specific messages separate. Add focused cases for positive fractions rounding to zero, limits, and malformed restored values.

**9. Stored-city validation accepts internally contradictory and non-finite records — P2, reproduced.**

[restoreCity](/Users/nigel/Developer/renttool/src/lib/cityCatalog.svelte.ts:64) checks several field types but does not require the name, city, and state to agree, positive rents, or matching source/metric semantics. [restoreCitySnapshot](/Users/nigel/Developer/renttool/src/lib/cityCatalog.svelte.ts:20) omits finite-number checks.

A local probe accepted a JSON record with `name: "Tampa, FL"`, `city: "Boston"`, `state: "MA"`, rent `-100`, HUD source paired with median-rent metric, and `1e999` population/income parsed as infinity. This is a malformed-data boundary issue; no claim is made that current stored user data contains it.

Proposal: parse `unknown` into a coherent city representation, derive redundant identity fields from one canonical identity, validate finite numeric domains, and normalize/reject contradictory source metadata. Prefer small explicit parsers over a broad new validation framework.

**10. JSON APIs are called typed but mostly trusted dynamically — P2.**

[api.ts](/Users/nigel/Developer/renttool/src/lib/api.ts:5) returns parsed response fields with limited validation. `fetchSuggestions` accepts any non-null `suggestions` value; `fetchNearby` checks only that the outer value is an array; coordinate checks do not enforce ranges; rent fields are taken from unvalidated JSON. The file-level “All degrade gracefully” claim also disagrees with `fetchSuggestions`, which can reject while other helpers return absence values. The discovery module currently catches that rejection, so this is not a confirmed autocomplete crash.

Proposal: use `unknown` at JSON boundaries, a few focused response parsers, and an explicit failure contract. Cover network rejection, invalid JSON, and malformed successful payloads at this seam. Do not add catches at every caller or replace all helpers with a generic request framework. [The literal RentSource cast](/Users/nigel/Developer/renttool/src/lib/api.ts:111) is also unnecessary.

**11. Presentation text is parsed back into application data — P2.**

[SearchLinks.svelte](/Users/nigel/Developer/renttool/src/lib/components/city/SearchLinks.svelte:17) identifies the recommended provider with `label.startsWith('Zillow')`, then [splits labels on `·`](/Users/nigel/Developer/renttool/src/lib/components/city/SearchLinks.svelte:69) to recover provider and rent-cap copy. A wording change can therefore change behavior or produce missing text.

Proposal: give [SearchLink](/Users/nigel/Developer/renttool/src/lib/searchLinks.ts:4) explicit provider identity, provider name, and optional cap/description fields. Choose the recommended provider by identity and render copy once. Likewise, use existing `city` and `state` fields instead of reparsing `city.name` merely to construct listing paths.

**12. Population mixes numbers, formatted strings, and an obsolete geography assumption — P2.**

[City.pop](/Users/nigel/Developer/renttool/src/lib/types.ts:30) is display text while ACS and nearby-place populations are numeric. Seed construction formats the number immediately. Off-list enrichment uses [popText](/Users/nigel/Developer/renttool/src/lib/format.ts:28), which adds “metro” solely when population is at least one million. The current population endpoint returns a nearest-place value; magnitude cannot establish metropolitan geography. The probe `popText(1500000)` returns `1.5M metro`.

Proposal: keep population numeric with explicit source/geography metadata, format at the view boundary, and remove the threshold-based “metro” claim. As an immediate bounded fix, remove the incorrect suffix without waiting for the full model migration.

**13. Identity normalization is repeatedly reimplemented — P2 design debt; broad user-visible duplication not reproduced.**

[Seed lookup](/Users/nigel/Developer/renttool/src/lib/data/cities.ts:144) normalizes punctuation and New York aliases; catalog membership, comparison membership, and URL matching use separate lowercase-only helpers. Images and external datasets add their own normalizers. Seed canonicalization repairs many normal flows, so different helpers alone do not prove a duplicate-city bug.

Proposal: define one app-level city identity/canonicalization policy for membership and persistence; retain provider-specific adapters for Census/image search where their rules genuinely differ. Add cross-boundary alias tests before consolidating. Do not blindly replace every normalizer with the most aggressive one.

**14. Missing numeric facts are converted into meaningful zeroes — P2.**

[ACS parsing](/Users/nigel/Developer/renttool/scripts/build-acs-city-data.py:143) converts invalid/negative fields to zero, and [payload construction](/Users/nigel/Developer/renttool/scripts/build-acs-city-data.py:228) uses `commute or 0` and `vacancy_rate or 0`. [CityFacts](/Users/nigel/Developer/renttool/src/lib/components/city/CityFacts.svelte:42) hides zero commute/vacancy values, while [comparison metrics](/Users/nigel/Developer/renttool/src/lib/compare/decision.ts:264) treat finite zero as real data, potentially the best commute.

The current bundle has no zero commute values and one zero vacancy value (Fairfax, VA). This audit did not establish whether that vacancy is measured zero or a missing-data fallback; the representation cannot tell us.

Proposal: preserve missing values as `null` through generator, type, storage, and view. Display actual zeroes consistently and exclude missing values from ranking. Add one missing-versus-zero fixture spanning generation and presentation.

## UI lifecycle and copied rendering logic

**15. Async component initialization can outlive destruction — P2, static lifecycle race.**

[LandingContent](/Users/nigel/Developer/renttool/src/lib/components/landing/LandingContent.svelte:23) initializes cleanup to a no-op, starts dynamic imports, and replaces cleanup after GSAP context creation. If the component disappears before the imports finish, cleanup has already run and the later context is never reverted. Its saved `root` is not passed into `gsap.context`, so selectors are document-scoped.

[RentMap](/Users/nigel/Developer/renttool/src/lib/components/city/RentMap.svelte:199) similarly awaits Leaflet before map creation. The separate destroy callback only removes an already-created map. Destruction during the import does not prevent later initialization.

Proposal: return synchronous cleanup from mounting, set a disposed flag, check it after imports, scope GSAP to the component root, and handle import rejection. Add a meaningful mount/unmount-before-import-resolution test. These races were established from control flow, not reproduced by slowing real browser downloads during this audit.

**16. Timers and request ownership have inconsistent cleanup — P3.**

[CityActions](/Users/nigel/Developer/renttool/src/lib/components/city/CityActions.svelte:14) keeps a timeout without destruction cleanup. Its two share-result branches repeat the same timer reset. [Coordinate lookups](/Users/nigel/Developer/renttool/src/lib/rentLookupCoordinator.ts:61) are deduplicated but cannot be aborted through the adapter, although the API function accepts a signal. Stale results are guarded, so that omission currently costs work rather than corrupting the plan.

Proposal: clear the share timeout on destruction and use one completion/reset path. For shared coordinate requests, add cancellation only with correct consumer ownership; never abort a request still needed by another intent. This is lower priority than fixing initialization-after-destruction.

**17. Comparison metric cells duplicate substantial markup — P2.**

[CompareMetricsTable.svelte](/Users/nigel/Developer/renttool/src/lib/components/compare/CompareMetricsTable.svelte:47) repeats cell tone, value animation, underline positioning, and labels for affordability and city-context groups. The two blocks already differ in title handling and border treatment.

Proposal: one local typed snippet for a metric row or cell, with the small intentional differences passed explicitly. Preserve accessible text and table structure. Avoid turning this one table into a generic table framework.

## Tests that add little value or resist legitimate change

**18. A marker identity assertion is a tautology — P2, confirmed.**

[rentMapMarkers.test.ts:30](/Users/nigel/Developer/renttool/src/lib/components/city/rentMapMarkers.test.ts:30) creates a map, remembers an entry, passes only its keys into a pure function, and asserts the untouched map still holds that entry. The implementation under test cannot replace the marker object in this test. The test title overstates what it proves.

Proposal: remove that assertion and rename the pure test to describe key/presentation output. Retain its useful assertions. If marker identity is the requirement, exercise actual reconciliation and check retained DOM or Leaflet object identity while salary changes.

**19. “Popstate before hydration” tests an absent listener — P3.**

[urlSync.test.ts:507](/Users/nigel/Developer/renttool/src/lib/urlSync.test.ts:507) dispatches before `start()` ever installs a listener, then verifies no navigation occurred. It does not exercise a listening-but-unhydrated transition.

Proposal: remove the misleading case or rename it as a minimal “construction has no browser side effects” test if that is an explicit requirement. Do not invent an unreachable lifecycle state merely to preserve the existing title. Keep the teardown listener-removal test.

**20. Generated-data tests pin incidental snapshots instead of transformation contracts — P2.**

[cities.test.ts](/Users/nigel/Developer/renttool/src/lib/data/cities.test.ts:5) hard-codes August 2026, NYC rents/trend, ACS values, and a lower-bound count. A legitimate monthly refresh then requires editing tests unrelated to a logic change. “Complete snapshot” is only partly established by `>= 632`; it is not exact source-key equality.

[city-images.test.ts](/Users/nigel/Developer/renttool/src/lib/data/city-images.test.ts:5) pins image IDs and photographer names. [The image browser test](/Users/nigel/Developer/renttool/tests/e2e/app.spec.ts:261) also pins editorial content. [The HUD browser smoke test](/Users/nigel/Developer/renttool/tests/e2e/app.spec.ts:77) hard-codes the annual release year.

Proposal: verify exact source-to-output key coverage, field mapping, coherent metadata, and valid attribution against the checked-in source. Use stable miniature fixtures for calculation/normalization expectations. Derive selected image credits and annual labels from the manifest/bundle unless the exact asset or release is an explicit product requirement. Keep independent source-quality checks; deriving expected fields from a source does not establish that the source itself is accurate. Existing rent E2E helpers already demonstrate the useful separation.

**21. Some browser tests claim more than they assert — P3.**

[Reload test](/Users/nigel/Developer/renttool/tests/e2e/app.spec.ts:683) says it restores city and salary but asserts only the city after reload. [Equivalence visibility test](/Users/nigel/Developer/renttool/tests/e2e/app.spec.ts:556) establishes only one-entry/two-entry visibility and partially overlaps a stronger equivalence test.

Proposal: add the missing salary assertion; fold the visibility boundary into the stronger test or retain it explicitly as a small visibility test. A dedicated visibility check is not inherently useless. Do not delete reload and fresh-link tests as duplicates: they exercise different persistence paths.

**22. Large test doubles and repeated fixtures obscure the real seam — P2/P3.**

[urlSync.test.ts](/Users/nigel/Developer/renttool/src/lib/urlSync.test.ts:33) maintains a substantial fake plan/browser/effect harness and casts the plan to the full presentation class at line 228. This can stay green while production Svelte wiring changes. Meanwhile comparison decision/equivalence tests duplicate city fixture builders, and salary/set tests import generated cities simply to obtain arbitrary distinct records.

Proposal: type URL sync against the small interface it actually consumes, keeping the fake checked against that interface. Preserve the existing real browser history coverage. Share a minimal city fixture where duplicated and use synthetic cities for pure salary/state tests. Do not replace independent calculation fixtures with production-generated expected answers, and do not introduce a giant fixture framework.

There were **no implementation-source-reading tests or filesystem “old file was deleted” assertions found**. Most negative assertions protect valid requirements: missing-data behavior, stale async results, origin exclusion, absence of `NaN`, or removal of comparison entries.

## Maintenance commands and consistency

**23. HUD refresh can put a new-year label on old-year data — P1, confirmed offline.**

[build-fmr-data.py](/Users/nigel/Developer/renttool/scripts/build-fmr-data.py:30) separately defaults the label and source URL to FY2026. Passing only `--year FY2027` changes the label but [still downloads DEFAULT_URL](/Users/nigel/Developer/renttool/scripts/build-fmr-data.py:148), then writes that data with the FY2027 label. Offline argument inspection confirmed this source/label combination without downloading anything.

Proposal: reject a non-default year without an explicit source, or derive a source consistently from a validated year. Validate source/year agreement when knowable. Add an offline CLI regression test. This should precede annual refresh work.

**24. Rent/ACS updater does not verify its promised result — P2.**

[update-data.py:63](/Users/nigel/Developer/renttool/scripts/update-data.py:63) rebuilds ACS when city membership differs and then returns. It never reloads the output and checks exact equality. The ACS builder accepts any match count at least 600, so a successful subprocess does not guarantee all 632 current rent cities are represented. An offline stubbed run confirmed no post-rebuild read/check.

Proposal: reload and compare exact city sets after rebuilding, fail with missing/extra identities if still mismatched, and test both repaired and still-incomplete results. Existing repository tests may catch missing snapshots later; the command itself should not report completion while its own contract is unmet.

**25. Output-writing and temporary-resource practices vary between builders — P2.**

[ACS output](/Users/nigel/Developer/renttool/scripts/build-acs-city-data.py:178) and [HUD output](/Users/nigel/Developer/renttool/scripts/build-fmr-data.py:151) overwrite checked-in JSON directly, unlike the atomic Apartment List writer. An interrupted write can truncate an importable bundle. The HUD downloader also uses a fixed `/tmp/<basename>` path and [opens ZipFile without a context manager](/Users/nigel/Developer/renttool/scripts/build-fmr-data.py:78).

Proposal: write a sibling temporary file and replace after successful serialization; use a scoped temporary directory and deterministic archive closure. A tiny shared writer is justified if it stays smaller than the duplicated policy. Test that a failed write leaves the original bundle intact. No need for a general data-pipeline framework.

**26. Input validation quietly overwrites or invents source values — P2.**

[Apartment List grouping](/Users/nigel/Developer/renttool/scripts/build-apartment-list-data.py:193) keeps the last row for a canonical city/bedroom pair, including alias collisions. [Population parsing](/Users/nigel/Developer/renttool/scripts/build-apartment-list-data.py:213) turns missing population into zero, accepts negative numbers, and emits low-level conversion errors for malformed text.

Proposal: reject conflicting duplicate rows with a helpful city/bedroom identifier and define an explicit missing-population policy. Validate numeric range/finiteness and surface meaningful errors. Add small duplicate/invalid-input fixtures. This is input-boundary hardening; the audit did not discover a current duplicate in the downloaded upstream source.

**27. Image-maintenance CLI has accidental broad scope and misleading success — P2.**

[Argument parsing](/Users/nigel/Developer/renttool/scripts/build-unsplash-images.ts:109) silently ignores unknown flags. `--city Tampa, FL` or an empty `--city=` can leave no requested cities and select the full catalog; `--refersh` is silently ignored.

[The main loop](/Users/nigel/Developer/renttool/scripts/build-unsplash-images.ts:196) conflates valid searches with no usable result, HTTP failures, JSON failures, and local write failures under “unavailable.” Authorization failure also breaks the loop and returns normally; the script has no nonzero outcome for that branch. A final manifest write and summary do not communicate failure to a calling process.

Proposal: use a strict existing-runtime argument parser or a small exhaustive parser, reject unknown/empty/malformed options, and parse arguments before requiring credentials. Separate expected no-image results from operational failures. Preserve accepted-entry checkpoints and quota wait/resume; return a nonzero status for authorization/transport/parse/write failure. Keep deliberate `--no-wait` quota stops an explicit documented outcome. Test orchestration with fake fetch/storage/time, without live Unsplash requests.

Repeated checkpoints are intentional reliability behavior, not grounds to remove checkpointing. A unique temporary filename alone would also not solve two processes overwriting each other's manifest; concurrency locking is a separate, lower-priority design question.

**28. Documentation and comments retain superseded architecture — P3, confirmed.**

- [README](/Users/nigel/Developer/renttool/README.md:235) says no GitHub Actions workflow is tracked; [.github/workflows/ci.yml](/Users/nigel/Developer/renttool/.github/workflows/ci.yml:1) exists and runs validation plus E2E.
- [README structure](/Users/nigel/Developer/renttool/README.md:212) says comparison salary drafts own persistence; their module explicitly says committed salaries live in `ComparisonSet`.
- [NearbyPlace comment](/Users/nigel/Developer/renttool/src/lib/types.ts:66) says Overpass although the endpoint uses bundled SimpleMaps.
- `City.r1/r2` comments call the figures median rents despite also holding HUD FMRs. Other tax comments omit the implemented local-tax component.
- Route/style comments narrate earlier card/sidebar designs. Some still explain useful constraints, but others describe old structure and create contradictory guidance for later agents.

Proposal: update factual comments alongside the relevant code, remove obsolete design-history narration, and keep comments explaining non-obvious constraints such as Leaflet focus handling or animation resting states. Do not replace deleted commentary with more commentary stating obvious code behavior.

## What I would keep

- Shared rent lookup leases, stale-result guards, and catalog reference checks. Their complexity corresponds to active/comparison concurrency and navigation behavior.
- Salary drafts separate from committed comparison salaries. That is an explicit domain requirement.
- Backward-compatible URL/storage readers until there is an intentional migration policy. An old format is not dead just because the current writer no longer produces it.
- Static credited city images and quota-aware checkpoint/resume. These are deliberate product/maintenance choices.
- The exhaustive reference implementation in spatial tests. It independently checks the optimized lookup, including boundaries and ordering.
- The deterministic autocomplete scheduler and most workspace tests. They test races and state transitions that a basic happy-path browser test does not cover.
- Small meaningful functions such as `salaryForRent`, `money`, geographic validation, and source-label helpers; reusable presentation components such as `SalaryInput` and `StatGrid`.
- The SvelteKit/Bun stack, existing package manager, and bounded five-entry comparison design.

I would not use low code coverage alone, the existence of classes, loops instead of `map`, or a file's length as proof of slop. Neither a rewrite nor bulk test deletion is justified by this audit.

## Proposed sequence

| Batch                                    | Scope                                                                                                                                  | Verification                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Make maintenance outcomes trustworthy | Findings 23–27: source/year binding, exact postconditions, atomic writes, strict image arguments and failure outcomes                  | Offline command-level tests, write-failure preservation, existing builder/image tests        |
| 2. Repair data boundaries                | Findings 8–10, 12, 14: normalized salaries, coherent stored cities, JSON decoding, numeric population, missing versus zero             | Focused malformed/restored-input cases and mapping tests; existing comparison/history E2E    |
| 3. Delete proven leftovers               | Findings 1–5 and 19: unused UI/API surfaces, snapshots, test-only adapter relocation, dead props                                       | Type check/build plus retained behavioral tests; no deletion tests                           |
| 4. Simplify active code                  | Findings 6–7, 11, 13, 15–17: narrow link inputs, keyed definitions, structured listing links, lifecycle ownership, local table snippet | URL/alias regression cases, delayed-import destruction test, comparison/map browser coverage |
| 5. Improve test and documentation signal | Findings 18, 20–22, 28: real identity coverage, refresh-safe expectations, missing assertions, small fixtures, current docs            | Unit and E2E suites; review each test for a plausible broken behavior it would catch         |

Each batch should remain reviewable and should preserve existing user-facing behavior except for the specific defects being repaired. Missing-value and persisted-city changes deserve explicit compatibility handling; they should not be mixed into a cosmetic deletion commit.

The most valuable first work is maintenance correctness and data boundaries. The safest immediate cleanup is deleting the verified unused surfaces. The broadest long-term improvement is to stop preserving multiple representations of the same state merely to accommodate old internal callers or test fixtures.

## Implemented cleanup — September 4, 2026

The approved cleanup is implemented in the working tree. Three implementation subagents used **gpt-5.6-luna** for maintenance scripts, runtime/state, and UI. The primary agent reviewed their combined changes, completed the comparison/URL/test/documentation work, and corrected integration gaps before validation. No dependency, framework, or package-manager migration was introduced.

| Finding | Completed change                                                                                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Deleted the unused Brand component and corrected README's component inventory.                                                                                                                                                                                                                            |
| 2       | Removed the unused comparison factory, link forwarding function, obsolete re-exports, and metric forwarding function. Removed population/text parsing helpers whose last callers disappeared during cleanup.                                                                                              |
| 3       | Deleted both test-only aggregate snapshot interfaces/getters. Behavioral tests now use the same focused getters as production.                                                                                                                                                                            |
| 4       | Moved the in-memory comparison-storage adapter into its test module.                                                                                                                                                                                                                                      |
| 5       | Removed the unused sharing and heading-level props, container token, budget assumptions field, and two-bedroom projection. The landing root now scopes animation selectors.                                                                                                                               |
| 6       | Narrowed comparison navigation to committed nested city/salary entries. Legacy public URL readers remain supported.                                                                                                                                                                                       |
| 7       | Replaced parallel metric/key lists with typed keyed definitions and direct criterion lookup. Removed runtime bookkeeping for static declarations.                                                                                                                                                         |
| 8       | Centralized salary normalization, including replacements and restored entries: round once, then require a positive in-range integer. Fractions that round to zero cannot be committed.                                                                                                                    |
| 9       | Hardened restored cities against inconsistent identities, nonpositive rents, source/metric contradictions, malformed coordinate pairs, and non-finite facts. Optional missing facts normalize to null.                                                                                                    |
| 10      | Parsed API payloads through explicit runtime checks, including coordinate ranges, FIPS formats, populations, and rents. All client wrappers retain absence-value failure contracts. Photon skips malformed features while retaining valid neighbors; FCC metadata cannot leak objects into string fields. |
| 11      | Added explicit listing provider identity, provider name, and cap description. Search links use structured city/state fields rather than splitting display text.                                                                                                                                           |
| 12      | Made population numeric with explicit provider metadata. Legacy recognizable numbers remain readable, unknown off-list provenance stays unknown, and obsolete bundled display strings can fall back to canonical seed data. Removed magnitude-based “metro” labeling.                                     |
| 13      | Shared one application identity policy across seed lookup, catalog, comparison membership, URL matching, workspace operations, and lookup coordination. Provider-specific matching remains separate.                                                                                                      |
| 14      | Preserved null versus zero through ACS generation, storage restoration, city facts, and comparison metrics. Missing optional table rows no longer discard a city with valid required facts.                                                                                                               |
| 15      | Guarded GSAP and Leaflet initialization after unmount; scoped GSAP to the landing component and consolidated map destruction. Browser tests delay the actual modules, navigate through SPA links, and inspect detached elements for late initialization.                                                  |
| 16      | Cleared sharing timers on destruction. Coordinate lookups now use shared leases that abort when the last owner releases, including superseded workspace intents.                                                                                                                                          |
| 17      | Reused one typed local snippet for comparison metric cells, preserving table semantics and the intentional title variation.                                                                                                                                                                               |
| 18      | Removed the tautological marker-object assertion. Added a browser test that verifies an actual marker DOM element survives a salary change.                                                                                                                                                               |
| 19      | Removed the test that claimed to exercise pre-hydration popstate handling without ever installing a listener. Listener teardown coverage remains.                                                                                                                                                         |
| 20      | Reworked generated-data tests around exact source membership, mapping, coherent metadata, and attribution. Browser asset and release expectations derive from checked-in data.                                                                                                                            |
| 21      | Added the omitted reload salary assertion and substantive reference-salary output to the equivalence visibility test.                                                                                                                                                                                     |
| 22      | Typed URL synchronization against its consumed interface, simplified its fake, removed the broad presentation-class cast, and shared synthetic city fixtures across pure comparison tests.                                                                                                                |
| 23      | Rejected non-default HUD years without explicit sources and recognizable HUD URL filenames that disagree with the selected fiscal year.                                                                                                                                                                   |
| 24      | Made the updater reload ACS after rebuilding and require exact rent-city membership. Tests exercise both successful and incomplete mocked rebuilds.                                                                                                                                                       |
| 25      | Shared one atomic Python JSON writer, with unique sibling temps, cleanup on serialization/replacement failure, and strict JSON serialization. HUD downloads use scoped directories and archives close deterministically.                                                                                  |
| 26      | Rejected conflicting duplicate city/bedroom rows and missing, negative, or non-finite source populations with useful errors.                                                                                                                                                                              |
| 27      | Rejected unknown/malformed image CLI arguments before credential lookup. Operational failures now reject rather than count as unavailable images. Accepted entries checkpoint immediately; unchanged manifests are not rewritten. Temporary output paths are unique and cleaned up.                       |
| 28      | Corrected CI, comparison persistence ownership, data/API semantics, tax/source comments, and obsolete UI-history narration.                                                                                                                                                                               |

**Validation and regression evidence**

- `bun run validate`: formatting, ESLint, Svelte/TypeScript (zero diagnostics), **213 Vitest tests across 28 files**, **23 Python tests**, and production build all passed.
- `bun run test:e2e`: **30 Chromium browser tests passed**, including accessibility, saved plans, history, comparisons, map identity, and delayed-import destruction.
- `git diff --check` passed.
- The actual browser lifecycle regressions were checked for sensitivity: removing the disposed guards made them fail; restoring the guards made them pass. Their final form waits for imported modules to finish rather than relying on a fixed delay.
- Shared coordinate cancellation is verified both in the coordinator and through workspace intents: superseding an active choice aborts unshared work, while a pending comparison keeps shared work alive until it too is canceled.
- API tests cover successful HUD mapping, malformed FIPS without starting a downstream request, invalid coordinates, non-finite population, network failures, HTTP failures, and invalid JSON.
- Atomic-write tests preserve the original bundle and clean temporary files after replacement or serialization failure. Maintenance tests use local fixtures and mocked requests/subprocesses.

**Compatibility and remaining evidence limits**

Existing URL formats and storage migrations remain supported. Malformed saved entries are rejected or normalized, while recognizable legacy population text and valid fractional salaries are migrated. A `--no-wait` Unsplash quota stop now exits nonzero with already accepted entries saved; README documents that intentional behavior. HUD year checks cannot establish the release of an arbitrarily renamed local workbook, so its source still needs maintainer review.

Bundled rent, ACS, HUD, place, and image JSON was not refreshed or changed. In particular, the existing Fairfax vacancy zero has not been reclassified: the old bundle does not establish whether it was measured or synthesized. Future ACS output preserves this distinction. No live maintenance refresh or Unsplash quota was used. This remains an application/maintenance cleanup, not a re-verification of the underlying public datasets or tax assumptions.
