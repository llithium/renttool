import { computeBudget } from '$lib/budget';
import {
  RentPlanWorkspace,
  type ComparisonResult,
  type RentPlanSnapshot
} from '$lib/appState.svelte';
import { MAX_COMPARISON_ENTRIES, type ComparisonEntry } from '$lib/compare/comparisonSet.svelte';
import type { Budget, City, CitySuggestion } from '$lib/types';

export interface RentPlanPresentationSnapshot {
  readonly salary: number | null;
  readonly activeCity: City | null;
  readonly selectedName: string | null;
  readonly rentTarget: number | null;
  readonly budget: Budget | null;
  readonly cities: readonly City[];
  readonly comparisonCities: readonly City[];
  readonly comparisonNames: readonly string[];
  readonly comparisonEntries: readonly ComparisonEntry[];
  readonly looking: boolean;
  readonly pendingName: string | null;
  readonly pendingComparisonNames: readonly string[];
  readonly mapFocusRequest: number;
}

/**
 * Presentation seam for the primary rent-planning flow.
 *
 * The workspace owns city resolution, comparison membership, persistence, and
 * URL restoration. This module adds the state the route needs to present that
 * work coherently: the active city, its rent target, intent-specific pending
 * state, and explicit map-focus requests.
 */
export class RentPlanPresentation {
  private readonly workspace: RentPlanWorkspace;
  private mapFocusRequestValue = $state(0);

  constructor(workspace: RentPlanWorkspace = new RentPlanWorkspace()) {
    this.workspace = workspace;
  }

  get salary(): number | null {
    return this.workspace.salary;
  }

  get activeCity(): City | null {
    return this.workspace.selected;
  }

  get selectedName(): string | null {
    return this.workspace.selectedName;
  }

  get cities(): City[] {
    return this.workspace.cities;
  }

  get comparisonCities(): City[] {
    return this.workspace.compareCities;
  }

  get comparisonNames(): string[] {
    return this.workspace.compareNames;
  }

  get comparisonEntries(): readonly ComparisonEntry[] {
    return this.workspace.compareEntries;
  }

  get comparisonLimit(): number {
    return MAX_COMPARISON_ENTRIES;
  }

  get comparisonFull(): boolean {
    return this.comparisonNames.length >= this.comparisonLimit;
  }

  get looking(): boolean {
    return this.workspace.looking;
  }

  get pendingName(): string | null {
    return this.workspace.pendingName;
  }

  get pendingComparisonNames(): string[] {
    return this.workspace.pendingComparisonNames;
  }

  get budget(): Budget | null {
    return this.salary == null ? null : computeBudget(this.salary, this.activeCity ?? undefined);
  }

  get rentTarget(): number | null {
    return this.budget?.maxRent ?? null;
  }

  get mapFocusRequest(): number {
    return this.mapFocusRequestValue;
  }

  get snapshot(): RentPlanPresentationSnapshot {
    const workspaceSnapshot: RentPlanSnapshot = this.workspace.snapshot;
    const budget = this.budget;
    return {
      salary: workspaceSnapshot.salary,
      activeCity: workspaceSnapshot.selected,
      selectedName: workspaceSnapshot.selectedName,
      rentTarget: budget?.maxRent ?? null,
      budget,
      cities: workspaceSnapshot.cities,
      comparisonCities: workspaceSnapshot.compareCities,
      comparisonNames: workspaceSnapshot.compareNames,
      comparisonEntries: workspaceSnapshot.compareEntries,
      looking: workspaceSnapshot.looking,
      pendingName: workspaceSnapshot.pendingName,
      pendingComparisonNames: workspaceSnapshot.pendingComparisonNames,
      mapFocusRequest: this.mapFocusRequest
    };
  }

  setSalary(value: number | null): void {
    this.workspace.setSalary(value);
  }

  chooseCity(suggestion: CitySuggestion): Promise<string> {
    return this.workspace.chooseCity(suggestion);
  }

  /** Select a known city without requesting a second map focus pass. */
  selectCity(name: string): boolean {
    return this.workspace.selectCity(name);
  }

  /** Select a comparison row and ask the map to focus the newly active city. */
  selectComparisonCity(name: string): boolean {
    const selected = this.workspace.selectCity(name);
    if (selected) this.requestMapFocus();
    return selected;
  }

  requestMapFocus(): void {
    this.mapFocusRequestValue += 1;
  }

  addComparison(input: string): ComparisonResult;
  addComparison(input: CitySuggestion): Promise<ComparisonResult>;
  addComparison(input: string | CitySuggestion): ComparisonResult | Promise<ComparisonResult> {
    return this.workspace.addComparison(input);
  }

  removeComparison(name: string): boolean {
    return this.workspace.removeComparison(name);
  }

  clearComparison(): void {
    this.workspace.clearComparison();
  }

  setComparisonSalary(name: string, value: number): boolean {
    return this.workspace.setComparisonSalary(name, value);
  }

  isComparing(name: string): boolean {
    return this.workspace.isComparing(name);
  }

  isComparisonPending(name: string): boolean {
    return this.workspace.isComparisonPending(name);
  }

  cityByName(name: string): City | null {
    return this.workspace.cityByName(name);
  }

  buildSearch(salaryOverride?: number | null): string {
    return this.workspace.buildSearch(salaryOverride);
  }

  buildHref(pathname: string): string {
    return this.workspace.buildHref(pathname);
  }

  buildShareUrl(origin: string): string {
    return new URL(this.buildHref('/'), origin).href;
  }

  hydrateFromSearch(search: URLSearchParams): boolean {
    return this.workspace.hydrateFromSearch(search);
  }

  applyUrlNavigation(search: URLSearchParams): void {
    this.workspace.applyUrlNavigation(search);
  }

  restoreSession(): void {
    this.workspace.restoreSession();
  }
}

export const rentPlanPresentation = new RentPlanPresentation();
