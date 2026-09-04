import {
  CityCatalog,
  offListSuggestion,
  restoreCity,
  type PlanSuggestion
} from '$lib/cityCatalog.svelte';
import { findSeedCity } from '$lib/data/cities';
import {
  ComparisonSet,
  LEGACY_PLAN_STORAGE_KEY,
  LEGACY_PLAN_V2_STORAGE_KEY,
  MAX_COMPARISON_ENTRIES,
  type ComparisonEntry
} from '$lib/compare/comparisonSet.svelte';
import {
  rentPlanHref,
  restoreRentPlan,
  serializeRentPlan,
  type RentPlanRepresentationInput,
  type RestoredRentPlan
} from '$lib/planRepresentation';
import { normalizeSalary } from '$lib/salary';
import { cityIdentity } from '$lib/cityIdentity';
import {
  createRentLookupCoordinator,
  type RentLookupAdapters,
  type RentLookupCoordinator
} from '$lib/rentLookupCoordinator';
import type { City, LookupResult } from '$lib/types';
import { fetchCoordinates, fetchPopulation, lookupRent } from '$lib/api';

const LAST_KEY = LEGACY_PLAN_STORAGE_KEY;
const LEGACY_KEY = LEGACY_PLAN_V2_STORAGE_KEY;
const PLAN_PERSISTENCE_DELAY_MS = 150;

type ResolutionIntent = 'active' | 'comparison';

interface ResolutionOperation {
  readonly intent: ResolutionIntent;
  cancelled: boolean;
  lookupRelease: (() => void) | null;
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

export interface RentPlanAdapters extends RentLookupAdapters {
  /** Production uses the population endpoint; tests can resolve immediately. */
  fetchPopulation: typeof fetchPopulation;
  /** Browser persistence is an adapter so the workflow is testable without a browser. */
  readStorage: (key: string) => string | null;
  writeStorage: (key: string, value: string) => void;
}

const browserAdapters: RentPlanAdapters = {
  lookupRent,
  fetchPopulation,
  coordinatesForPlace: fetchCoordinates,
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
 * Callers express intent (`chooseCity`, `addComparison`, `setSalary`) and read focused
 * state getters. Lookup, persistence, canonicalization, cancellation, and capacity
 * rules remain behind this seam, so the route and city modules do not need to
 * coordinate the workflow themselves.
 */
export class RentPlanWorkspace {
  private salaryValue = $state<number | null>(null);
  private selectedNameValue = $state<string | null>(null);
  /** The active-city lane and comparison lane have independent pending state. */
  private pendingNameValue = $state<string | null>(null);
  private pendingComparisonNamesValue = $state<string[]>([]);
  private readonly adapters: RentPlanAdapters;
  private readonly comparisonSet: ComparisonSet;
  private readonly cityCatalog: CityCatalog;
  private readonly lookupCoordinator: RentLookupCoordinator;
  private activeOperation: ResolutionOperation | null = null;
  private readonly comparisonTasks = new Map<string, ComparisonTask>();
  private readonly comparisonRestoreOperations = new Map<string, ResolutionOperation>();
  private persistenceTimer: ReturnType<typeof setTimeout> | undefined;
  private persistencePending = false;
  private readonly coordinateReleases = new Map<string, () => void>();

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
    this.cityCatalog = new CityCatalog((city) => this.comparisonSet.updateCity(city));
    this.lookupCoordinator = createRentLookupCoordinator(
      {
        lookupRent: adapters.lookupRent,
        coordinatesForPlace: adapters.coordinatesForPlace
      },
      (name, result) => this.applyRentLookup(name, result)
    );
  }

  get salary(): number | null {
    return this.salaryValue;
  }

  get cities(): City[] {
    return this.cityCatalog.cities;
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
    const key = cityIdentity(name);
    return this.pendingComparisonNamesValue.some((pending) => cityIdentity(pending) === key);
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
    return this.cityCatalog.byName(name);
  }

  /** Set the offer salary and queue the new plan for persistence. Invalid input clears it. */
  setSalary(value: number | null) {
    this.salaryValue = normalizeSalary(value);
    this.schedulePersistence();
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
    for (const release of this.coordinateReleases.values()) release();
    this.coordinateReleases.clear();
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
    const key = cityIdentity(name);
    if (this.pendingComparisonNamesValue.some((pending) => cityIdentity(pending) === key)) return;
    this.pendingComparisonNamesValue = [...this.pendingComparisonNamesValue, name];
  }

  private clearComparisonPending(name: string): void {
    const key = cityIdentity(name);
    this.pendingComparisonNamesValue = this.pendingComparisonNamesValue.filter(
      (pending) => cityIdentity(pending) !== key
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
    this.persistImmediately();
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
   * coordinate list. The endpoint keeps the full place dataset server-side. */
  private async ensureCoordinates(name: string) {
    const city = this.cityByName(name);
    if (!city || city.lat != null || city.lng != null) return;
    const coordinateKey = cityIdentity(name);
    if (this.coordinateReleases.has(coordinateKey)) return;
    const lease = this.lookupCoordinator.acquireCoordinates(city.city, city.state);
    this.coordinateReleases.set(coordinateKey, lease.release);
    try {
      const coords = await lease.promise;
      if (
        coords &&
        this.coordinateReleases.get(coordinateKey) === lease.release &&
        this.cityCatalog.patchIfCurrent(city, { lat: coords[0], lng: coords[1] })
      ) {
        // A selected city can start without curated coordinates. Its initial
        // population attempt necessarily ran before this lookup completed, so
        // retry now that the population endpoint has a usable point.
        void this.ensurePopulation(name);
      }
    } finally {
      lease.release();
      if (this.coordinateReleases.get(coordinateKey) === lease.release)
        this.coordinateReleases.delete(coordinateKey);
    }
  }

  private popLookups = new WeakMap<City, Set<string>>();

  /** Fill a missing population from the bundled places endpoint. */
  private async ensurePopulation(name: string) {
    const city = this.cityByName(name);
    if (!city || city.pop != null || city.lat == null || city.lng == null) return;
    const lat = city.lat;
    const lng = city.lng;
    const key = `${lat},${lng}`;
    const cityLookups = this.popLookups.get(city) ?? new Set<string>();
    if (cityLookups.has(key)) return;
    cityLookups.add(key);
    this.popLookups.set(city, cityLookups);
    try {
      const pop = await this.adapters.fetchPopulation(lat, lng);
      if (pop != null && this.cityByName(name) === city && city.lat === lat && city.lng === lng) {
        this.cityCatalog.patchIfCurrent(city, { pop, populationSource: 'simplemaps' });
        this.persistImmediately();
      }
    } finally {
      const currentLookups = this.popLookups.get(city);
      currentLookups?.delete(key);
      if (currentLookups?.size === 0) this.popLookups.delete(city);
    }
  }

  private commitComparison(name: string): ComparisonResult {
    const city = this.cityByName(name);
    if (!city) return { status: 'not-found', name };
    const result = this.comparisonSet.add(city, this.salary);
    this.persistImmediately();
    return result;
  }

  /** Add a city to comparison without changing the active plan. */
  addComparison(input: string): ComparisonResult;
  addComparison(input: PlanSuggestion): Promise<ComparisonResult>;
  addComparison(input: string | PlanSuggestion): ComparisonResult | Promise<ComparisonResult>;
  addComparison(input: PlanSuggestion | string): ComparisonResult | Promise<ComparisonResult> {
    const requestedName = typeof input === 'string' ? input : input.label;
    const canonicalName =
      typeof input === 'string' ? requestedName : this.cityCatalog.canonicalSuggestion(input).label;
    const key = cityIdentity(canonicalName);
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
    const key = cityIdentity(name);
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
    if (removed) this.persistImmediately();
    return removed;
  }

  clearComparison() {
    this.cancelComparisonOperations();
    this.comparisonSet.clear();
    this.persistImmediately();
  }

  setComparisonSalary(name: string, value: number): boolean {
    this.flushPersistence();
    return this.comparisonSet.setSalary(name, value);
  }

  isComparing(name: string): boolean {
    return this.comparisonSet.isComparing(name);
  }

  /** Resolve a city from an autocomplete suggestion: add it if new, then fill rent
   * from the bundled HUD table if it isn't a seed city. Returns the canonical name.
   * Nearby-place picks carry an OSM population — used as an instant prefill. */
  private operationIsCurrent(operation: ResolutionOperation): boolean {
    return operation.intent === 'active'
      ? this.activeOperationIsCurrent(operation)
      : !operation.cancelled;
  }

  private applyRentLookup(name: string, result: LookupResult): void {
    if (result.source === 'none') return;
    this.cityCatalog.patch(name, {
      r1: result.r1,
      r2: result.r2,
      yoy: result.yoy,
      source: result.source,
      rentMetric: result.rentMetric,
      rentArea: result.rentArea,
      rentYear: result.rentYear
    });
    this.persistImmediately();
  }

  /** Hold one cancellable rent lookup between active and comparison intents. */
  private acquireRentLookup(
    target: PlanSuggestion,
    operation: ResolutionOperation
  ): Promise<LookupResult> {
    const lease = this.lookupCoordinator.acquireRent({
      name: target.label,
      lat: target.lat!,
      lng: target.lng!
    });
    operation.lookupRelease = lease.release;
    return lease.promise;
  }

  private async resolveSuggestion(
    sug: PlanSuggestion,
    options: { select?: boolean; operation: ResolutionOperation }
  ): Promise<string> {
    const selectOnResolve = options.select ?? true;
    const operation = options.operation;
    const prefillPop = sug.pop != null && sug.pop > 0 ? sug.pop : null;
    const seed = findSeedCity(sug.label);
    let target = this.cityCatalog.canonicalSuggestion(sug);
    if (!this.operationIsCurrent(operation)) return target.label;
    if (seed) {
      // Ensure the seed city carries coords for the map.
      if (seed.lat == null && target.lat != null && target.lng != null) {
        this.cityCatalog.patch(seed.name, { lat: target.lat, lng: target.lng });
      }
      if (seed.pop == null && prefillPop != null)
        this.cityCatalog.patch(seed.name, { pop: prefillPop, populationSource: 'simplemaps' });
      if (seed.r1 != null) {
        if (selectOnResolve && this.activeOperationIsCurrent(operation)) {
          this.commitSelection(seed.name);
        }
        return seed.name;
      }
    }

    if (!seed && (target.lat == null || target.lng == null)) {
      this.markOperationPending(operation, target.label);
      const coordinateLease = this.lookupCoordinator.acquireCoordinates(target.city, target.state);
      operation.lookupRelease = coordinateLease.release;
      try {
        const coords = await coordinateLease.promise;
        if (!this.operationIsCurrent(operation)) return target.label;
        if (coords) target = { ...target, lat: coords[0], lng: coords[1] };
      } finally {
        coordinateLease.release();
        operation.lookupRelease = null;
      }
    }

    let existing = this.cityByName(target.label);
    if (!existing) {
      existing = this.cityCatalog.ensurePlaceholder({ ...target, pop: sug.pop });
    } else if (existing.pop == null && prefillPop != null) {
      this.cityCatalog.patch(target.label, { pop: prefillPop, populationSource: 'simplemaps' });
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
      this.persistImmediately();
    }
  }

  private schedulePersistence(): void {
    this.persistencePending = true;
    if (this.persistenceTimer !== undefined) clearTimeout(this.persistenceTimer);
    this.persistenceTimer = setTimeout(() => {
      this.persistenceTimer = undefined;
      this.flushPersistence();
    }, PLAN_PERSISTENCE_DELAY_MS);
  }

  /** Flush the latest pending plan state and cancel any deferred write. */
  flushPersistence(): void {
    if (!this.persistencePending) return;
    this.persistencePending = false;
    if (this.persistenceTimer !== undefined) {
      clearTimeout(this.persistenceTimer);
      this.persistenceTimer = undefined;
    }

    try {
      // Off-list cities added via autocomplete aren't in the seed set — store them
      // whole so selection/comparison survives a reload.
      const referencedNames = new Set<string>();
      if (this.selectedNameValue) referencedNames.add(cityIdentity(this.selectedNameValue));
      for (const entry of this.comparisonSet.entries) {
        referencedNames.add(cityIdentity(entry.city.name));
      }
      const custom = this.cityCatalog.referencedCustom(referencedNames);
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

  private persistImmediately(): void {
    this.persistencePending = true;
    this.flushPersistence();
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

  private startComparisonRestore(suggestion: PlanSuggestion): void {
    const canonical = this.cityCatalog.canonicalSuggestion(suggestion);
    const key = cityIdentity(canonical.label);
    if (this.comparisonRestoreOperations.has(key) || this.comparisonTasks.has(key)) return;
    const operation = this.createOperation('comparison');
    this.comparisonRestoreOperations.set(key, operation);
    this.markComparisonPending(canonical.label);
    void this.resolveSuggestion(canonical, { select: false, operation }).finally(() => {
      this.finishComparisonRestore(key, operation);
    });
  }

  private scheduleLookup(suggestion: PlanSuggestion, select: boolean): string {
    const city = this.cityCatalog.ensurePlaceholder(suggestion);
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
        if (suggestion) city = this.cityCatalog.ensurePlaceholder(suggestion);
      }
      if (!city) continue;

      const cityKey = cityIdentity(city.name);
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
      const city = this.cityCatalog.ensurePlaceholder(suggestion);
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
    this.persistImmediately();

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
    this.persistImmediately();
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
        const restoredSalary = normalizeSalary(restoredPlan.salary);
        if (restoredSalary != null) this.salaryValue = restoredSalary;
        if (Array.isArray(restoredPlan.custom)) {
          const valid = restoredPlan.custom
            .map(restoreCity)
            .filter((c: City | null): c is City => c != null);
          this.cityCatalog.addMissing(valid);
        }
        if (typeof restoredPlan.selected === 'string' && this.cityByName(restoredPlan.selected)) {
          this.selectedNameValue = restoredPlan.selected;
          void this.ensureCoordinates(restoredPlan.selected);
          void this.ensurePopulation(restoredPlan.selected);
        }
      }

      this.comparisonSet.restore({ resolveCity: (name) => this.cityByName(name) });
      this.cityCatalog.addMissing(this.comparisonSet.entries.map((entry) => entry.city));

      if (!this.adapters.readStorage(LAST_KEY) && raw) this.persistImmediately();
    } catch {
      /* ignore */
    }
  }
}
