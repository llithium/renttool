<script lang="ts">
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
  class="mt-8 border-t border-line pt-7"
  aria-labelledby="salary-equivalence-heading"
>
  <div class="flex flex-col justify-between gap-5 md:flex-row md:items-end">
    <div class="max-w-2xl">
      <h2 id="salary-equivalence-heading" class="text-title">Equivalent salary by city</h2>
      <p class="mt-2 text-sm/relaxed text-muted">
        Match each city's estimated monthly take-home after a typical 1BR using the existing
        single-filer tax assumptions.
      </p>
    </div>
    <div class="flex w-full max-w-sm flex-col gap-2 md:items-end">
      <label for="salary-equivalence-reference" class="text-label text-muted">
        Match spending room from
      </label>
      <select
        id="salary-equivalence-reference"
        aria-label="Match spending room from"
        value={analysis.referenceName ?? ''}
        onchange={(event) => onreferencechange((event.currentTarget as HTMLSelectElement).value)}
        class="w-full cursor-pointer border border-line-strong bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      >
        {#each analysis.entries as entry (entry.city.name)}
          <option value={entry.city.name}>{entry.city.name}</option>
        {/each}
      </select>
    </div>
  </div>

  <p class="mt-5 text-meta text-muted">
    Target spending room: <span class="font-semibold text-ink">{analysis.targetMonthlyValue}</span>
  </p>

  <div class="mt-5 grid grid-cols-1 border-t border-l border-line-strong md:grid-cols-2">
    {#each analysis.entries as entry (entry.city.name)}
      <article class="border-r border-b border-line-strong bg-card p-5 md:p-6">
        <div class="flex items-start justify-between gap-3">
          <p class="text-headline text-ink">{entry.city.name}</p>
          {#if entry.isReference}
            <span
              class="shrink-0 border border-line-strong px-2 py-1 text-meta font-semibold text-muted"
              >Reference</span
            >
          {/if}
        </div>
        <dl class="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div>
            <dt class="text-meta text-muted">Annual salary</dt>
            <dd class="mt-1 text-data text-ink tabular-nums">{entry.committedSalaryValue}/yr</dd>
          </div>
          <div>
            <dt class="text-meta text-muted">Equivalent salary</dt>
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
    Estimates do not model utilities, benefits, debt, or moving costs.
  </p>
</section>
