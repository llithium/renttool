<script lang="ts">
  import Select from '$lib/components/ui/Select.svelte';
  import type { SalaryEquivalenceView } from '$lib/compare/salaryEquivalence';

  let {
    analysis,
    onreferencechange
  }: {
    analysis: SalaryEquivalenceView;
    onreferencechange: (name: string) => void;
  } = $props();
</script>

<section
  data-testid="salary-equivalence"
  class="mt-6 border-t border-line pt-5"
  aria-labelledby="salary-equivalence-heading"
>
  <div class="flex flex-col justify-between gap-5 md:flex-row md:items-end">
    <div class="max-w-2xl">
      <h2 id="salary-equivalence-heading" tabindex="-1" class="scroll-mt-24 text-title">
        Equivalent salary by city
      </h2>
      <p class="mt-2 text-sm/relaxed text-muted">
        Match cash left after {analysis.housingLabel} rent{analysis.hasPersonalCosts
          ? ', expenses, and savings'
          : ''}. Required salaries use the single-filer tax estimates{analysis.usesActualReference
          ? '; your reference uses entered take-home pay'
          : ''}.
      </p>
    </div>
    <div class="w-full max-w-sm">
      <Select
        id="salary-equivalence-reference"
        label="Match spending room from"
        value={analysis.referenceName ?? ''}
        options={analysis.entries.map((entry) => ({
          value: entry.city.name,
          label: entry.city.name
        }))}
        onchange={onreferencechange}
      />
    </div>
  </div>

  <p class="mt-5 text-meta text-muted">
    Target spending room: <span class="font-semibold text-ink">{analysis.targetMonthlyValue}</span>
  </p>

  <div data-equivalent-list>
    <div data-equivalent-labels class="text-meta text-muted" aria-hidden="true">
      <span>City</span>
      <span>Annual salary</span>
      <span>Estimated equivalent</span>
    </div>
    {#each analysis.entries as entry (entry.city.name)}
      <article data-equivalent-row>
        <div class="flex items-start justify-between gap-3">
          <p class="text-title text-ink">{entry.city.name}</p>
          {#if entry.isReference}
            <span class="shrink-0 pt-1 text-meta font-semibold text-accent">Reference</span>
          {/if}
        </div>
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-meta text-muted md:sr-only">Annual salary</dt>
            <dd class="mt-1 text-data text-ink tabular-nums">{entry.committedSalaryValue}/yr</dd>
          </div>
          <div>
            <dt class="text-meta text-muted md:sr-only">Estimated equivalent</dt>
            <dd class="mt-1 text-data text-ink tabular-nums">
              {entry.requiredSalaryValue}{#if entry.requiredSalary != null}/yr{/if}
            </dd>
          </div>
        </dl>
        {#if entry.unavailableReason}
          <p class="mt-4 text-meta text-muted" role="status">{entry.unavailableReason}</p>
        {/if}
      </article>
    {/each}
  </div>

  <p class="mt-4 max-w-3xl text-meta text-muted">
    This matches after-rent cash, not the full cost of living. Enter expenses for costs such as
    utilities and debt; entered take-home pay includes your paycheck deductions.
  </p>
</section>

<style>
  [data-equivalent-list] {
    margin-top: 1rem;
    border-top: 1px solid var(--line-strong);
  }

  [data-equivalent-labels] {
    display: none;
  }

  [data-equivalent-row] {
    display: grid;
    gap: 0.875rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--line);
  }

  @media (min-width: 768px) {
    [data-equivalent-labels] {
      display: grid;
      grid-template-columns: minmax(0, 1fr) repeat(2, minmax(0, 0.75fr));
      gap: 1rem;
      padding-top: 0.875rem;
    }

    [data-equivalent-row] {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
      align-items: center;
      gap: 1rem;
    }
  }
</style>
