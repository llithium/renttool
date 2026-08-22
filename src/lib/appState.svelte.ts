import { SEED_CITIES, findSeedCity, STATE_TAX, stateOf, cityOf } from '$lib/data/cities';
import {
  ComparisonSet,
  LEGACY_PLAN_STORAGE_KEY,
  LEGACY_PLAN_V2_STORAGE_KEY,
  MAX_COMPARISON_ENTRIES,
  restoreCity,
  type ComparisonEntry
} from '$lib/compare/comparisonSet.svelte';
import { popText } from '$lib/format';
import {
  isValidCoordinates,
  rentPlanHref,
  restoreRentPlan,
  serializeRentPlan,
  type RentPlanRepresentationInput,
  type RestoredRentPlan
} from '$lib/planRepresentation';
import { MAX_SALARY } from '$lib/salary';
import type { City, CitySuggestion, LookupResult } from '$lib/types';
import { fetchPopulation, lookupRent } from '$lib/api';

const LAST_KEY = LEGACY_PLAN_STORAGE_KEY;
const LEGACY_KEY = LEGACY_PLAN_V2_STORAGE_KEY;

function cloneSeed(): City[] {
  return SEED_CITIES.map((c) => ({ ...c }));
}

type PlanSuggestion = CitySuggestion & {
  pop?: number | null;
};

function offListSuggestion(name: string, lat: number, lng: number): PlanSuggestion | null {
  const state = stateOf(name);
  if (
    name.length === 0 ||
    name.length > 100 ||
    cityOf(name).length === 0 ||
    !/^[A-Z]{2}$/.test(state) ||
    !isValidCoordinates(lat, lng)
  ) {
    return null;
  }
  return { label: name, city: cityOf(name), state, lat, lng };
}

function unavailableLookup(): LookupResult {
  return {
    r1: null,
    r2: null,
    yoy: null,
    source: 'none',
    rentMetric: 'unknown',
    rentArea: '',
    rentYear: ''
  };
}

export interface RentPlanSnapshot {
  readonly salary: number | null;
  readonly selected: City | null;
  readonly selectedName: string | null;
  readonly cities: readonly City[];
  readonly compareCities: readonly City[];
  readonly compareNames: readonly string[];
  readonly compareEntries: readonly ComparisonEntry[];
  readonly looking: boolean;
  readonly pendingName: string | null;
  readonly pendingComparisonNames: readonly string[];
}

type ResolutionIntent = 'active' | 'comparison';

interface ResolutionOperation {
  readonly intent: ResolutionIntent;
  cancelled: boolean;
  lookupRelease: (() => void) | null;
}

interface SharedRentLookup {
  readonly controller: AbortController;
  promise: Promise<LookupResult>;
  readonly consumers: Set<ResolutionOperation>;
}

interface ComparisonTask {
  readonly operation: ResolutionOperation;
  promise: Promise<ComparisonResult>;
}

export type ComparisonResult =
  | { status: 'added'; name: string; city: City; salary: number; rentAvailable: boolean }
  | { status: 'already-compared'; name: string; city: City; salary: number }
  | { status: 'full'; name: string | null }
  | { status: 'not-found'; name: string };

export interface RentPlanAdapters {
  /** Production uses the typed server endpoint; tests can return a local result. */
  lookupRent: typeof lookupRent;
  /** Production uses the population endpoint; tests can resolve immediately. */
  fetchPopulation: typeof fetchPopulation;
  /** Lazy place-data lookup keeps the initial bundle small. */
  coordinatesForPlace: (
    city: string,
    state: string
  ) => Promise<readonly [number, number] | undefined>;
  /** Browser persistence is an adapter so the workflow is testable without a browser. */
  readStorage: (key: string) => string | null;
  writeStorage: (key: string, value: string) => void;
}

const browserAdapters: RentPlanAdapters = {
  lookupRent,
  fetchPopulation,
  coordinatesForPlace: async (city, state) => {
    const { coordinatesForPlace } = await import('$lib/data/places');
    return coordinatesForPlace(city, state) ?? undefined;
  },
  readStorage: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  writeStorage: (key, value) => {
    localStorage.setItem(key, value);
  }
};

/**
 * The rent-plan workspace module.
 *
 * Callers express intent (`chooseCity`, `addComparison`, `setSalary`) and read a
 * snapshot. Lookup, persistence, canonicalization, cancellation, and capacity
 * rules remain behind this seam, so the route and city modules do not need to
 * coordinate the workflow themselves.
 */
export class RentPlanWorkspace {
  private salaryValue = $state<number | null>(null);
  private citiesValue = $state<City[]>(cloneSeed());
  private selectedNameValue = $state<string | null>(null);
  /** The active-city lane and comparison lane have independent pending state. */
  private pendingNameValue = $state<string | null>(null);
  private pendingComparisonNamesValue = $state<string[]>([]);
  private readonly adapters: RentPlanAdapters;
  private readonly comparisonSet: ComparisonSet;
  private activeOperation: ResolutionOperation | null = null;
  private readonly comparisonTasks = new Map<string, ComparisonTask>();
  private readonly comparisonRestoreOperations = new Map<string, ResolutionOperation>();
  private readonly rentLookups = new Map<string, SharedRentLookup>();
  private readonly coordinateLookups = new Map<
    string,
    Promise<readonly [number, number] | undefined>
  >();

  constructor(adapters: RentPlanAdapters = browserAdapters) {
    this.adapters = adapters;
    this.comparisonSet = new ComparisonSet({
      storage: {
        read: (key) => adapters.readStorage(key),
        write: (key, value) => {
          adapters.writeStorage(key, value);
          return true;
        }
      }
    });
  }

  get salary(): number | null {
    return this.salaryValue;
  }

  get cities(): City[] {
    return this.citiesValue;
  }

  get selectedName(): string | null {
    return this.selectedNameValue;
  }

  get compareNames(): string[] {
    return [...this.comparisonSet.names];
  }

  get looking(): boolean {
    return this.pendingNameValue != null;
  }

  get pendingName(): string | null {
    return this.pendingNameValue;
  }

  get pendingComparisonNames(): string[] {
    return [...this.pendingComparisonNamesValue];
  }

  isComparisonPending(name: string): boolean {
    const key = name.toLowerCase();
    return this.pendingComparisonNamesValue.some((pending) => pending.toLowerCase() === key);
  }

  get selected(): City | null {
    return this.selectedName ? this.cityByName(this.selectedName) : null;
  }

  get compareCities(): City[] {
    return [...this.comparisonSet.cities];
  }

  get compareEntries(): readonly ComparisonEntry[] {
    return this.comparisonSet.entries;
  }

  cityByName(name: string): City | null {
    const t = name.toLowerCase();
    return this.cities.find((c) => c.name.toLowerCase() === t) ?? null;
  }

  get snapshot(): RentPlanSnapshot {
    return {
      salary: this.salary,
      selected: this.selected,
      selectedName: this.selectedName,
      cities: this.cities,
      compareCities: this.compareCities,
      compareNames: this.compareNames,
      compareEntries: this.compareEntries,
      looking: this.looking,
      pendingName: this.pendingName,
      pendingComparisonNames: this.pendingComparisonNames
    };
  }

  /** Set the offer salary and persist the new plan. Invalid input clears it. */
  setSalary(value: number | null) {
    this.salaryValue =
      value != null && Number.isFinite(value) && value > 0 && value <= MAX_SALARY
        ? Math.round(value)
        : null;
    this.persist();
  }

  private createOperation(intent: ResolutionIntent): ResolutionOperation {
    return { intent, cancelled: false, lookupRelease: null };
  }

  private cancelOperation(operation: ResolutionOperation): void {
    if (operation.cancelled) return;
    operation.cancelled = true;
    operation.lookupRelease?.();
    operation.lookupRelease = null;
  }

  private cancelActiveOperation(): void {
    if (this.activeOperation) this.cancelOperation(this.activeOperation);
    this.activeOperation = null;
    this.pendingNameValue = null;
  }

  private beginActiveOperation(): ResolutionOperation {
    this.cancelActiveOperation();
    const operation = this.createOperation('active');
    this.activeOperation = operation;
    return operation;
  }

  private activeOperationIsCurrent(operation: ResolutionOperation): boolean {
    return !operation.cancelled && this.activeOperation === operation;
  }

  private markComparisonPending(name: string): void {
    const key = name.toLowerCase();
    if (this.pendingComparisonNamesValue.some((pending) => pending.toLowerCase() === key)) return;
    this.pendingComparisonNamesValue = [...this.pendingComparisonNamesValue, name];
  }

  private clearComparisonPending(name: string): void {
    const key = name.toLowerCase();
    this.pendingComparisonNamesValue = this.pendingComparisonNamesValue.filter(
      (pending) => pending.toLowerCase() !== key
    );
  }

  private markOperationPending(operation: ResolutionOperation, name: string): void {
    if (operation.intent === 'active') this.pendingNameValue = name;
    else this.markComparisonPending(name);
  }

  private finishActiveOperation(operation: ResolutionOperation): void {
    if (this.activeOperation === operation) {
      this.activeOperation = null;
      this.pendingNameValue = null;
    }
    operation.lookupRelease?.();
    operation.lookupRelease = null;
  }

  private finishComparisonOperation(key: string, operation: ResolutionOperation): void {
    if (this.comparisonTasks.get(key)?.operation === operation) {
      this.comparisonTasks.delete(key);
      this.clearComparisonPending(key);
    }
    operation.lookupRelease?.();
    operation.lookupRelease = null;
  }

  private finishComparisonRestore(key: string, operation: ResolutionOperation): void {
    if (this.comparisonRestoreOperations.get(key) === operation) {
      this.comparisonRestoreOperations.delete(key);
      this.clearComparisonPending(key);
    }
    operation.lookupRelease?.();
    operation.lookupRelease = null;
  }

  private cancelAllResolutions(): void {
    this.cancelActiveOperation();
    this.cancelComparisonOperations();
  }

  private cancelComparisonOperations(): void {
    for (const task of this.comparisonTasks.values()) this.cancelOperation(task.operation);
    for (const operation of this.comparisonRestoreOperations.values()) {
      this.cancelOperation(operation);
    }
    this.comparisonTasks.clear();
    this.comparisonRestoreOperations.clear();
    this.pendingComparisonNamesValue = [];
  }

  /** Select a city after its rent record is ready (or explicitly unavailable). */
  selectCity(name: string): boolean {
    if (!this.cityByName(name)) return false;
    this.cancelActiveOperation();
    return this.commitSelection(name);
  }

  private commitSelection(name: string): boolean {
    if (!this.cityByName(name)) return false;
    this.selectedNameValue = name;
    this.persist();
    void this.ensureCoordinates(name);
    void this.ensurePopulation(name);
    return true;
  }

  /** Explicit city-navigation intent. Comparison additions use addComparison instead. */
  async chooseCity(suggestion: PlanSuggestion): Promise<string> {
    const operation = this.beginActiveOperation();
    return this.resolveSuggestion(suggestion, { select: true, operation }).finally(() => {
      this.finishActiveOperation(operation);
    });
  }

  /** Hydrate map coordinates for a bundled rent city that is not in the curated
   * coordinate list. The place dataset is loaded only when this fallback is needed. */
  private async ensureCoordinates(name: string) {
    const city = this.cityByName(name);
    if (!city || city.lat != null || city.lng != null) return;
    const coords = await this.coordinatesFor(city.city, city.state);
    if (coords) this.patchCity(name, { lat: coords[0], lng: coords[1] });
  }

  private coordinatesFor(
    city: string,
    state: string
  ): Promise<readonly [number, number] | undefined> {
    const key = `${city.toLowerCase()},${state.toLowerCase()}`;
    const existing = this.coordinateLookups.get(key);
    if (existing) return existing;
    let request: Promise<readonly [number, number] | undefined>;
    try {
      request = Promise.resolve(this.adapters.coordinatesForPlace(city, state));
    } catch {
      request = Promise.resolve(undefined);
    }
    const lookup = request
      .catch(() => undefined)
      .finally(() => {
        if (this.coordinateLookups.get(key) === lookup) this.coordinateLookups.delete(key);
      });
    this.coordinateLookups.set(key, lookup);
    return lookup;
  }

  private popLookups = new Set<string>();

  /** Fill in a missing population figure for a city (fire-and-forget).
   * Curated seed blurbs like "2.8M metro" are kept as-is. */
  private async ensurePopulation(name: string) {
    const city = this.cityByName(name);
    if (!city || city.pop || city.lat == null || city.lng == null) return;
    const key = name.toLowerCase();
    if (this.popLookups.has(key)) return;
    this.popLookups.add(key);
    try {
      const pop = await this.adapters.fetchPopulation(city.lat, city.lng);
      if (pop != null) {
        this.patchCity(name, { pop: popText(pop) });
        this.persist();
      }
    } finally {
      this.popLookups.delete(key);
    }
  }

  private commitComparison(name: string): ComparisonResult {
    const city = this.cityByName(name);
    if (!city) return { status: 'not-found', name };
    const result = this.comparisonSet.add(city, this.salary);
    this.persist();
    return result;
  }

  /** Add a city to comparison without changing the active plan. */
  addComparison(input: string): ComparisonResult;
  addComparison(input: PlanSuggestion): Promise<ComparisonResult>;
  addComparison(input: string | PlanSuggestion): ComparisonResult | Promise<ComparisonResult>;
  addComparison(input: PlanSuggestion | string): ComparisonResult | Promise<ComparisonResult> {
    const requestedName = typeof input === 'string' ? input : input.label;
    const canonicalName =
      typeof input === 'string' ? requestedName : this.canonicalSuggestion(input).label;
    const key = canonicalName.toLowerCase();
    const known = this.cityByName(requestedName) ?? this.cityByName(canonicalName);
    if (known && this.isComparing(known.name)) {
      return this.comparisonSet.add(known, this.salary);
    }
    if (typeof input !== 'string') {
      const pending = this.comparisonTasks.get(key);
      if (pending) return pending.promise;
    }
    if (this.comparisonSet.size >= MAX_COMPARISON_ENTRIES) {
      return { status: 'full', name: known?.name ?? requestedName };
    }

    if (typeof input === 'string') return this.commitComparison(input);
    const operation = this.createOperation('comparison');
    this.markComparisonPending(canonicalName);
    const task = {
      operation,
      promise: Promise.resolve({ status: 'not-found', name: canonicalName } as ComparisonResult)
    } satisfies ComparisonTask;
    task.promise = this.resolveSuggestion(input, { select: false, operation })
      .then((name) =>
        operation.cancelled ? { status: 'not-found' as const, name } : this.commitComparison(name)
      )
      .finally(() => this.finishComparisonOperation(key, operation));
    this.comparisonTasks.set(key, task);
    return task.promise;
  }

  /** Remove one comparison entry without changing the active plan. */
  removeComparison(name: string): boolean {
    const key = name.toLowerCase();
    const task = this.comparisonTasks.get(key);
    if (task) {
      this.cancelOperation(task.operation);
      this.comparisonTasks.delete(key);
      this.clearComparisonPending(key);
    }
    const restore = this.comparisonRestoreOperations.get(key);
    if (restore) {
      this.cancelOperation(restore);
      this.comparisonRestoreOperations.delete(key);
      this.clearComparisonPending(key);
    }
    const removed = this.comparisonSet.remove(name);
    if (removed) this.persist();
    return removed;
  }

  clearComparison() {
    this.cancelComparisonOperations();
    this.comparisonSet.clear();
    this.persist();
  }

  setComparisonSalary(name: string, value: number): boolean {
    return this.comparisonSet.setSalary(name, value);
  }

  isComparing(name: string): boolean {
    return this.comparisonSet.isComparing(name);
  }

  /** Resolve a city from an autocomplete suggestion: add it if new, then fill rent
   * from the bundled HUD table if it isn't a seed city. Returns the canonical name.
   * Nearby-place picks carry an OSM population — used as an instant prefill. */
  private canonicalSuggestion(suggestion: PlanSuggestion): PlanSuggestion {
    const seed = findSeedCity(suggestion.label);
    return seed
      ? { ...suggestion, label: seed.name, city: seed.city, state: seed.state }
      : suggestion;
  }

  private operationIsCurrent(operation: ResolutionOperation): boolean {
    return operation.intent === 'active'
      ? this.activeOperationIsCurrent(operation)
      : !operation.cancelled;
  }

  private applyRentLookup(name: string, result: LookupResult): void {
    if (result.source === 'none') return;
    this.patchCity(name, {
      r1: result.r1,
      r2: result.r2,
      yoy: result.yoy,
      source: result.source,
      rentMetric: result.rentMetric,
      rentArea: result.rentArea,
      rentYear: result.rentYear
    });
    this.persist();
  }

  /** Share one cancellable rent lookup between active and comparison intents. */
  private acquireRentLookup(
    target: PlanSuggestion,
    operation: ResolutionOperation
  ): Promise<LookupResult> {
    const key = target.label.toLowerCase();
    let lookup = this.rentLookups.get(key);
    if (lookup?.controller.signal.aborted) {
      this.rentLookups.delete(key);
      lookup = undefined;
    }
    if (!lookup) {
      const controller = new AbortController();
      lookup = {
        controller,
        promise: Promise.resolve(unavailableLookup()),
        consumers: new Set()
      };
      this.rentLookups.set(key, lookup);
      let request: Promise<LookupResult>;
      try {
        request = Promise.resolve(
          this.adapters.lookupRent(target.lat!, target.lng!, controller.signal)
        );
      } catch {
        request = Promise.resolve(unavailableLookup());
      }
      lookup.promise = request
        .catch(() => unavailableLookup())
        .then((result) => {
          if (!controller.signal.aborted) this.applyRentLookup(target.label, result);
          return result;
        })
        .finally(() => {
          if (this.rentLookups.get(key) === lookup) this.rentLookups.delete(key);
        });
    }

    lookup.consumers.add(operation);
    operation.lookupRelease = () => {
      if (!lookup?.consumers.delete(operation)) return;
      if (!lookup.consumers.size && this.rentLookups.get(key) === lookup) {
        lookup.controller.abort();
      }
    };
    return lookup.promise;
  }

  private async resolveSuggestion(
    sug: PlanSuggestion,
    options: { select?: boolean; operation: ResolutionOperation }
  ): Promise<string> {
    const selectOnResolve = options.select ?? true;
    const operation = options.operation;
    const prefillPop = sug.pop != null && sug.pop > 0 ? popText(sug.pop) : '';
    const seed = findSeedCity(sug.label);
    let target = this.canonicalSuggestion(sug);
    if (!this.operationIsCurrent(operation)) return target.label;
    if (seed) {
      // Ensure the seed city carries coords for the map.
      if (seed.lat == null && target.lat != null && target.lng != null) {
        this.patchCity(seed.name, { lat: target.lat, lng: target.lng });
      }
      if (!seed.pop && prefillPop) this.patchCity(seed.name, { pop: prefillPop });
      if (seed.r1 != null) {
        if (selectOnResolve && this.activeOperationIsCurrent(operation)) {
          this.commitSelection(seed.name);
        }
        return seed.name;
      }
    }

    if (!seed && (target.lat == null || target.lng == null)) {
      this.markOperationPending(operation, target.label);
      const coords = await this.coordinatesFor(target.city, target.state);
      if (!this.operationIsCurrent(operation)) return target.label;
      if (coords) {
        target = { ...target, lat: coords[0], lng: coords[1] };
      }
    }

    let existing = this.cityByName(target.label);
    if (!existing) {
      existing = this.ensureOffListPlaceholder({ ...target, pop: sug.pop });
    } else if (!existing.pop && prefillPop) {
      this.patchCity(target.label, { pop: prefillPop });
    }

    // Load rent BEFORE switching the view. Selecting immediately would flash the
    // whole results column: every rent-dependent card (verdict, charts) collapses
    // while r1 is null, then re-expands when rent lands. Keeping the current city
    // rendered until the new one is ready swaps old-full → new-full with no reflow.
    // The clicked place shows a loading affordance via pendingName in the meantime.
    // If the city already has rent (revisited), skip the wait and select now.
    if (existing.r1 != null) {
      if (selectOnResolve && this.activeOperationIsCurrent(operation)) {
        this.commitSelection(target.label);
      }
      return target.label;
    }

    // Local seed suggestions can be useful before their map coordinates are
    // hydrated. They cannot take the coordinate-based HUD lookup path yet.
    if (target.lat == null || target.lng == null) {
      if (selectOnResolve && this.activeOperationIsCurrent(operation)) {
        this.commitSelection(target.label);
      }
      return target.label;
    }

    this.markOperationPending(operation, target.label);

    const lookup = this.acquireRentLookup(target, operation);
    try {
      await lookup;
      if (!this.operationIsCurrent(operation)) return target.label;
      if (selectOnResolve) this.commitSelection(target.label); // atomic swap now that rent is in
      return target.label;
    } finally {
      operation.lookupRelease?.();
      operation.lookupRelease = null;
      this.persist();
    }
  }

  private patchCity(name: string, patch: Partial<City>) {
    const t = name.toLowerCase();
    this.citiesValue = this.citiesValue.map((c) =>
      c.name.toLowerCase() === t ? { ...c, ...patch } : c
    );
    const updated = this.cityByName(name);
    if (updated) this.comparisonSet.updateCity(updated);
  }

  private persist() {
    try {
      // Off-list cities added via autocomplete aren't in the seed set — store them
      // whole so selection/comparison survives a reload.
      const seedNames = new Set(SEED_CITIES.map((c) => c.name.toLowerCase()));
      const referencedNames = new Set<string>();
      if (this.selectedNameValue) referencedNames.add(this.selectedNameValue.toLowerCase());
      for (const entry of this.comparisonSet.entries) {
        referencedNames.add(entry.city.name.toLowerCase());
      }
      const custom = this.citiesValue.filter(
        (c) => !seedNames.has(c.name.toLowerCase()) && referencedNames.has(c.name.toLowerCase())
      );
      this.adapters.writeStorage(
        LAST_KEY,
        JSON.stringify({
          salary: this.salaryValue,
          selected: this.selectedNameValue,
          custom
        })
      );
    } catch {
      /* ignore */
    }
  }

  private currentPlanRepresentation(
    salary: number | null = this.salary
  ): RentPlanRepresentationInput {
    return {
      salary,
      selected: this.selected,
      comparisons: this.compareEntries
    };
  }

  /** Serialize the shareable state (salary, selected city, compare list) into a
   * canonical query string. Fixed param order so equal state yields an identical
   * string — the write-effect relies on that to short-circuit no-op updates.
   * Coords ride along only for an off-list selected city, so a fresh recipient can
   * re-resolve its rent (see hydrateFromSearch). */
  buildSearch(salaryOverride?: number | null): string {
    return serializeRentPlan(
      this.currentPlanRepresentation(salaryOverride === undefined ? this.salary : salaryOverride)
    );
  }

  /** Build a route that carries the complete current rent plan. */
  buildHref(pathname: string): string {
    return rentPlanHref(pathname, this.currentPlanRepresentation());
  }

  private ensureOffListPlaceholder(suggestion: PlanSuggestion): City {
    const canonical = findSeedCity(suggestion.label);
    const existing = this.cityByName(canonical?.name ?? suggestion.label);
    if (existing) {
      const patch: Partial<City> = {};
      if (existing.source === 'apartment-list') {
        if (existing.lat == null && suggestion.lat != null) patch.lat = suggestion.lat;
        if (existing.lng == null && suggestion.lng != null) patch.lng = suggestion.lng;
      } else {
        const coordinatesChanged =
          (suggestion.lat != null && existing.lat !== suggestion.lat) ||
          (suggestion.lng != null && existing.lng !== suggestion.lng);
        if (suggestion.lat != null && existing.lat !== suggestion.lat) patch.lat = suggestion.lat;
        if (suggestion.lng != null && existing.lng !== suggestion.lng) patch.lng = suggestion.lng;
        if (coordinatesChanged) {
          patch.r1 = null;
          patch.r2 = null;
          patch.yoy = null;
          patch.source = 'none';
          patch.rentMetric = 'unknown';
          patch.rentArea = suggestion.label;
          patch.rentYear = '';
        }
      }
      if (!existing.pop && suggestion.pop != null && suggestion.pop > 0) {
        patch.pop = popText(suggestion.pop);
      }
      if (Object.keys(patch).length) this.patchCity(existing.name, patch);
      return this.cityByName(existing.name) ?? existing;
    }

    const city: City = {
      name: suggestion.label,
      city: suggestion.city,
      state: suggestion.state,
      r1: null,
      r2: null,
      yoy: null,
      tax: STATE_TAX[suggestion.state] || 'varies',
      pop: suggestion.pop != null && suggestion.pop > 0 ? popText(suggestion.pop) : '',
      citySnapshot: null,
      lat: suggestion.lat,
      lng: suggestion.lng,
      source: 'none',
      rentMetric: 'unknown',
      rentArea: suggestion.label,
      rentYear: ''
    };
    this.citiesValue = [...this.citiesValue, city];
    return city;
  }

  private startComparisonRestore(suggestion: PlanSuggestion): void {
    const canonical = this.canonicalSuggestion(suggestion);
    const key = canonical.label.toLowerCase();
    if (this.comparisonRestoreOperations.has(key) || this.comparisonTasks.has(key)) return;
    const operation = this.createOperation('comparison');
    this.comparisonRestoreOperations.set(key, operation);
    this.markComparisonPending(canonical.label);
    void this.resolveSuggestion(canonical, { select: false, operation }).finally(() => {
      this.finishComparisonRestore(key, operation);
    });
  }

  private scheduleLookup(suggestion: PlanSuggestion, select: boolean): string {
    const city = this.ensureOffListPlaceholder(suggestion);
    if (city.source === 'apartment-list' || city.r1 != null) {
      if (select) this.commitSelection(city.name);
      return city.name;
    }
    const hydrated = {
      ...suggestion,
      label: city.name,
      city: city.city,
      state: city.state,
      lat: city.lat,
      lng: city.lng
    };
    if (select) {
      const operation = this.beginActiveOperation();
      void this.resolveSuggestion(hydrated, { select: true, operation }).finally(() => {
        this.finishActiveOperation(operation);
      });
    } else {
      this.startComparisonRestore(hydrated);
    }
    return city.name;
  }

  private applyComparisonSearch(
    representation: RestoredRentPlan,
    scheduleLookup: (suggestion: PlanSuggestion, select: boolean) => string
  ): void {
    const entries: ComparisonEntry[] = [];
    const seen = new Set<string>();

    for (const restored of representation.comparisons) {
      let city: City | null = null;
      let suggestion: PlanSuggestion | null = null;
      if (restored.city.kind === 'bundled') {
        city = this.cityByName(restored.city.name);
        if (city?.source !== 'apartment-list') city = null;
      } else if (restored.city.lat != null && restored.city.lng != null) {
        suggestion = offListSuggestion(restored.city.name, restored.city.lat, restored.city.lng);
        if (suggestion) city = this.ensureOffListPlaceholder(suggestion);
      }
      if (!city) continue;

      const cityKey = city.name.toLowerCase();
      if (seen.has(cityKey)) continue;
      seen.add(cityKey);
      entries.push({ city, salary: restored.salary });
      if (suggestion && city.source !== 'apartment-list' && city.r1 == null) {
        scheduleLookup(suggestion, false);
      }
    }

    this.comparisonSet.replace(entries);
  }

  private applySelectedReference(
    selected: RestoredRentPlan['selected'],
    scheduleLookup: (suggestion: PlanSuggestion, select: boolean) => string
  ): boolean {
    if (!selected) return false;
    if (selected.kind === 'off-list') {
      if (selected.lat == null || selected.lng == null) return false;
      const suggestion = offListSuggestion(selected.name, selected.lat, selected.lng);
      if (!suggestion) return false;
      const city = this.ensureOffListPlaceholder(suggestion);
      if (city.r1 != null) this.commitSelection(city.name);
      else scheduleLookup(suggestion, true);
      return true;
    }
    if (selected.kind !== 'bundled') return false;
    const known = this.cityByName(selected.name);
    if (known?.source !== 'apartment-list') return false;
    this.commitSelection(known.name);
    return true;
  }

  /** Seed state from URL query params. URL comparison state is authoritative. */
  hydrateFromSearch(search: URLSearchParams): boolean {
    this.cancelAllResolutions();
    const representation = restoreRentPlan(search);
    if (representation.salary != null) this.salaryValue = representation.salary;
    const scheduleLookup = (suggestion: PlanSuggestion, select: boolean) =>
      this.scheduleLookup(suggestion, select);
    const selectedCity = this.applySelectedReference(representation.selected, scheduleLookup);
    const hasLinkState = selectedCity || representation.hasComparisonState;
    // A salary-only link may still fall back to session storage; once the URL
    // names plan state, an invalid salary must not leak an older local value.
    if (hasLinkState && search.has('salary') && representation.salary == null) {
      this.salaryValue = null;
    }
    if (hasLinkState) this.applyComparisonSearch(representation, scheduleLookup);
    this.persist();

    return hasLinkState;
  }

  /** Apply URL params on browser back/forward navigation. URL state is the sole
   * source of truth, including the complete comparison set. */
  applyUrlNavigation(search: URLSearchParams) {
    this.cancelAllResolutions();
    const representation = restoreRentPlan(search);
    this.salaryValue = representation.salary;
    this.selectedNameValue = null;
    const scheduleLookup = (suggestion: PlanSuggestion, select: boolean) =>
      this.scheduleLookup(suggestion, select);
    this.applySelectedReference(representation.selected, scheduleLookup);
    this.applyComparisonSearch(representation, scheduleLookup);
    this.persist();
  }

  restoreSession() {
    try {
      const raw = this.adapters.readStorage(LAST_KEY) ?? this.adapters.readStorage(LEGACY_KEY);
      let restoredPlan: Record<string, unknown> | null = null;
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            restoredPlan = parsed as Record<string, unknown>;
          }
        } catch {
          // The comparison set can still restore its own representation.
        }
      }

      if (restoredPlan) {
        if (
          typeof restoredPlan.salary === 'number' &&
          Number.isFinite(restoredPlan.salary) &&
          restoredPlan.salary > 0 &&
          restoredPlan.salary <= MAX_SALARY
        ) {
          this.salaryValue = restoredPlan.salary;
        }
        if (Array.isArray(restoredPlan.custom)) {
          const valid = restoredPlan.custom
            .map(restoreCity)
            .filter((c: City | null): c is City => c != null);
          if (valid.length) {
            const have = new Set(this.citiesValue.map((c) => c.name.toLowerCase()));
            this.citiesValue = [
              ...this.citiesValue,
              ...valid.filter((c: City) => !have.has(c.name.toLowerCase()))
            ];
          }
        }
        if (typeof restoredPlan.selected === 'string' && this.cityByName(restoredPlan.selected)) {
          this.selectedNameValue = restoredPlan.selected;
          void this.ensureCoordinates(restoredPlan.selected);
          void this.ensurePopulation(restoredPlan.selected);
        }
      }

      this.comparisonSet.restore({ resolveCity: (name) => this.cityByName(name) });
      const have = new Set(this.citiesValue.map((city) => city.name.toLowerCase()));
      const restoredCities = this.comparisonSet.entries
        .map((entry) => entry.city)
        .filter((city) => !have.has(city.name.toLowerCase()));
      if (restoredCities.length) {
        this.citiesValue = [...this.citiesValue, ...restoredCities];
      }

      if (!this.adapters.readStorage(LAST_KEY) && raw) this.persist();
    } catch {
      /* ignore */
    }
  }
}

export const app = new RentPlanWorkspace();
