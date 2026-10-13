<script lang="ts">
  import type { ComparisonEntry } from '$lib/compare/decision';
  import type { CompareSalaries } from '$lib/compare/salaries.svelte';
  import { findCityImage } from '$lib/data/city-images';
  import SalaryInput from '$lib/components/ui/SalaryInput.svelte';
  import MonthlyAmountInput from '$lib/components/ui/MonthlyAmountInput.svelte';
  import { housingShortLabel, type HousingChoice } from '$lib/planning';

  let {
    entry,
    href,
    salaries,
    housing,
    ontakehome,
    defaultExpenses,
    onexpenses,
    onremove
  }: {
    entry: ComparisonEntry;
    href: string;
    salaries: CompareSalaries;
    housing: HousingChoice;
    ontakehome: (value: number | null) => void;
    defaultExpenses: number;
    onexpenses: (value: number | null) => void;
    onremove: () => void;
  } = $props();

  let image = $derived.by(() => {
    const [city, state] = entry.city.name.split(/,\s*/);
    return state ? findCityImage(city, state) : null;
  });
  let result = $derived(entry.fit);
</script>

<article data-testid="scenario" class="min-w-0 rounded-2xl border border-line bg-card p-5 md:p-7">
  {#if image}
    <figure class="mb-5">
      <a {href} tabindex="-1" aria-hidden="true"
        ><img
          src={image.url}
          alt=""
          loading="lazy"
          class="h-20 w-full rounded-xl object-cover"
          onerror={(event) => {
            if (event.currentTarget instanceof HTMLImageElement)
              event.currentTarget.style.display = 'none';
          }}
        /></a
      >
      <figcaption class="mt-1 text-meta text-muted">
        Photo: <a href={image.photographerUrl} target="_blank" rel="noopener" class="underline"
          >{image.photographerName}</a
        >
        / <a href={image.sourceUrl} target="_blank" rel="noopener" class="underline">Unsplash</a>
      </figcaption>
    </figure>
  {/if}
  <div class="flex min-h-12 items-start justify-between gap-2">
    <div>
      <h2 class="text-[clamp(1.75rem,3vw,3rem)] leading-none font-semibold tracking-[-0.045em]">
        <a {href} class="text-ink no-underline hover:text-inherit">{entry.city.name}</a>
      </h2>
      <p class="mt-0.5 text-meta text-muted">{entry.rent.metricLabel}</p>
    </div>
    <button
      onclick={onremove}
      aria-label={`Remove ${entry.city.name}`}
      class="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-transparent p-3 text-muted hover:border-red hover:text-red"
    >
      <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="m4.5 4.5 7 7m0-7-7 7"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <SalaryInput
    id={`salary-${entry.city.name.replace(/[^a-z0-9]+/gi, '-')}`}
    label="Salary for this city"
    ariaLabel={`Annual salary in ${entry.city.name}`}
    size="md"
    value={salaries.displayed(entry.city.name, entry.salary)}
    error={salaries.errors[entry.city.name] ?? ''}
    oninput={(event) => salaries.oninput(entry.city.name, event)}
    onblur={() => salaries.commit(entry.city.name)}
    class="mt-4"
  />

  <details class="mt-3">
    <summary class="min-h-11 cursor-pointer text-meta font-semibold text-muted"
      >Use actual take-home pay</summary
    >
    <MonthlyAmountInput
      id={`take-home-${entry.city.name.replace(/[^a-z0-9]+/gi, '-')}`}
      label={`Monthly take-home in ${entry.city.name}`}
      value={entry.actualTakeHomeMonthly ?? null}
      onchange={ontakehome}
      hint="Leave blank to estimate taxes. Applies to this salary only."
    />
  </details>

  <details class="mt-3">
    <summary class="min-h-11 cursor-pointer text-meta font-semibold text-muted"
      >Expenses for this city{entry.monthlyExpenses != null ? ' · customized' : ''}</summary
    >
    <MonthlyAmountInput
      id={`expenses-${entry.city.name.replace(/[^a-z0-9]+/gi, '-')}`}
      label={`Monthly expenses in ${entry.city.name}`}
      value={entry.monthlyExpenses ?? null}
      onchange={onexpenses}
      hint={`Leave blank to use the shared default ($${defaultExpenses.toLocaleString()}/mo). Enter 0 for no expenses.`}
    />
  </details>
  <div class="mt-8 grid grid-cols-2 gap-4 border-t border-line-strong pt-5">
    <div class="min-w-0">
      <span class="block text-meta text-muted">{housingShortLabel(housing)} rent</span>
      <strong class="mt-0.5 block text-data tabular-nums">
        {entry.metrics.selectedRent.value}
      </strong>
    </div>
    <div class="min-w-0">
      <span class="block text-meta text-muted">Rent ceiling</span>
      {#key entry.rentBudget.amount}
        <strong class="motion-value mt-0.5 block text-data tabular-nums">
          {entry.rentBudget.value}
        </strong>
      {/key}
    </div>
  </div>

  <p class="mt-4 text-sm tabular-nums">
    <span class="text-muted">Available after rent &amp; goals</span>
    <strong class="ml-2 text-ink">{entry.metrics.after.value}</strong>
  </p>
  <p class="mt-1 text-meta text-muted">
    {entry.actualTakeHomeMonthly != null ? 'Entered take-home pay' : 'Estimated take-home pay'} · {entry.rentProvenance}
  </p>

  <div
    class="mt-4 border-t-2 pt-3 text-sm font-semibold {result.tone === 'good'
      ? 'border-green text-green'
      : result.tone === 'bad'
        ? 'border-red text-red'
        : 'border-line-strong text-muted'}"
  >
    {#key result.label}
      <span class="motion-copy inline-block">{result.label}</span>
    {/key}
  </div>
  {#if entry.rent.amount == null}
    <p class="mt-2 text-meta text-muted">
      We could not match a rent estimate for this housing setup. Open the city name above for
      available rent context and alternatives.
    </p>
  {/if}
</article>
