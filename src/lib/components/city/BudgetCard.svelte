<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { housingRent, housingShortLabel, rentTargetFit } from '$lib/planning';
  import { money } from '$lib/format';
  import Verdict from './Verdict.svelte';
  let {
    presentation,
    oneditcosts
  }: { presentation: RentPlanPresentation; oneditcosts: () => void } = $props();
  let budget = $derived(presentation.budget);
  let city = $derived(presentation.activeCity);
  let ceiling = $derived(presentation.rentTarget);
  let rent = $derived(city ? housingRent(city, presentation.options.housing) : null);
  let available = $derived(presentation.spendingRoom?.available);
  let usesGrossTarget = $derived(budget != null && ceiling === budget.maxRent);
  // The scale ends at the actual rent or ceiling, whichever is higher.
  let rulerMaximum = $derived(Math.max(rent ?? 0, ceiling ?? 0));
  let rentGap = $derived(ceiling != null && rent != null ? ceiling - rent : null);
  let rentPosition = $derived(rulerMaximum > 0 ? ((rent ?? 0) / rulerMaximum) * 100 : 0);
  let ceilingPosition = $derived(rulerMaximum > 0 ? ((ceiling ?? 0) / rulerMaximum) * 100 : 0);
  let spendingLabel = $derived(
    presentation.options.monthlyExpenses > 0
      ? presentation.options.monthlySavings > 0
        ? 'After rent, expenses & savings'
        : 'After rent & expenses'
      : presentation.options.monthlySavings > 0
        ? 'After rent & savings'
        : 'After rent, before expenses'
  );
</script>

{#if city}
  <section
    id="plan-summary"
    tabindex="-1"
    aria-label="Plan summary"
    data-plan-summary
    class="@container scroll-mt-28"
    data-testid="plan-summary"
  >
    {#if budget}
      <div data-ceiling-answer>
        <h2>{usesGrossTarget ? 'Rent ceiling' : 'Personal rent ceiling'}</h2>
        <p data-ceiling-value>{money(ceiling)}<span>/mo</span></p>
        <p data-ceiling-basis>
          {usesGrossTarget ? '30% of gross income' : 'Based on your take-home pay, costs and goals'}
        </p>
      </div>
      <div id="rent-decision" data-rent-fit={rentTargetFit(rent, ceiling ?? 0)}>
        <Verdict
          {budget}
          {city}
          housing={presentation.options.housing}
          target={ceiling ?? budget.maxRent}
          personal={!usesGrossTarget}
        />
      </div>
      <dl data-supporting-metrics>
        <div>
          <dt>Local {housingShortLabel(presentation.options.housing)} estimate</dt>
          <dd>
            {rent == null ? 'Unavailable' : money(rent)}{#if rent != null}<span>/mo</span>{/if}
          </dd>
        </div>
        <div>
          <dt>{spendingLabel}</dt>
          <dd class:text-red={available != null && available < 0}>
            {money(available)}<span>/mo</span>
          </dd>
          {#if (presentation.options.monthlyBuffer ?? 0) > 0}
            <dd data-buffer-note>
              Before your {money(presentation.options.monthlyBuffer)} buffer
              {#if available != null && (presentation.options.monthlyBuffer ?? 0) > available}
                <span class="block text-red"
                  >Buffer shortfall: {money(
                    (presentation.options.monthlyBuffer ?? 0) - available
                  )}/mo</span
                >
              {/if}
            </dd>
          {/if}
        </div>
      </dl>
      <div class="mt-5 flex flex-wrap gap-3">
        <a
          href="#apartment-check"
          onclick={() => {
            const details = document.querySelector('#apartment-check details');
            if (details instanceof HTMLDetailsElement) details.open = true;
          }}
          class="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-ink no-underline hover:opacity-90"
          >Check an apartment</a
        >
        <a
          href="#listing-search"
          class="inline-flex min-h-12 items-center rounded-lg border border-line-strong bg-card px-5 py-3 text-sm font-semibold text-ink no-underline hover:bg-card-2"
          >Find listings</a
        >
      </div>
      {#if rent != null && ceiling != null}
        <div
          role="img"
          aria-label={`Monthly rent comparison: local ${housingShortLabel(presentation.options.housing)} estimate ${money(rent)}; rent ceiling ${money(ceiling)}. Both marks use the same scale from $0.`}
          data-rent-comparison
        >
          <div data-scale-legend aria-hidden="true">
            <span><i></i>Local rent</span><span><b></b>Ceiling</span><span
              class={rentGap != null && rentGap >= 0 ? 'text-green' : 'text-red'}
              ><i style:background={rentGap != null && rentGap >= 0 ? 'var(--green)' : 'var(--red)'}
              ></i>{money(Math.abs(rentGap ?? 0))}
              {rentGap != null && rentGap >= 0 ? 'below' : 'above'} ceiling</span
            >
          </div>
          <div data-rent-scale aria-hidden="true">
            <div data-rent-amount style:width={`${rentPosition}%`}></div>
            <div
              data-rent-gap
              class={rent <= ceiling ? 'bg-green' : 'bg-red'}
              style:left={`${Math.min(rentPosition, ceilingPosition)}%`}
              style:width={`${Math.abs(ceilingPosition - rentPosition)}%`}
            ></div>
            <span data-rent-pointer style:left={`${ceilingPosition}%`}></span>
          </div>
          <div data-scale-extents aria-hidden="true">
            <span>$0</span><span>{rent <= ceiling ? 'Rent ceiling' : 'Local rent'}</span>
          </div>
        </div>
      {/if}
      {#if presentation.options.monthlyExpenses === 0}
        <div data-expense-prompt>
          <span>Expenses not entered</span><button type="button" onclick={oneditcosts}
            >Add your expenses</button
          >
        </div>
      {/if}
      <p data-estimate-context>
        {#if rent != null}
          {money(presentation.actualTakeHomeMonthly ?? budget.takeHomeMonthly)} take-home minus {money(
            rent
          )} rent{presentation.options.monthlyExpenses > 0 ||
          presentation.options.monthlySavings > 0
            ? ', then entered costs and savings'
            : ''}.
        {/if}
        {presentation.actualTakeHomeMonthly != null
          ? 'Uses your entered take-home pay.'
          : 'Estimated pay assumes a single filer taking the standard deduction.'}
      </p>
      <details>
        <summary>How this estimate works</summary>
        <p data-estimate-context>
          {usesGrossTarget
            ? 'Using 30% of gross income.'
            : `Limited by take-home pay after your costs and goals, capped at ${money(budget.maxRent)} (30% of gross income).`}
          {#if (presentation.options.monthlyBuffer ?? 0) > 0}Buffer target: {money(
              presentation.options.monthlyBuffer
            )}/mo.{/if}
          {presentation.actualTakeHomeMonthly != null
            ? 'Spending room uses entered take-home pay.'
            : 'Spending room uses estimated take-home pay.'}
          Rent is a market estimate, not an apartment quote.
          <a href="#sources" class="text-accent underline underline-offset-2">Methods and sources</a
          >
        </p>
      </details>
    {:else}
      <h2 class="text-title">What rent fits here?</h2>
      <p class="mt-2 max-w-sm text-sm text-muted">
        Enter your annual salary above to see your ceiling, local rent, and spending room.
      </p>
    {/if}
  </section>
{/if}

<style>
  [data-plan-summary] {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 1.25rem;
    background: var(--card);
    padding: 1.25rem 1.5rem;
    box-shadow: var(--elevation-card);
  }
  [data-ceiling-answer] h2 {
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0;
  }
  [data-ceiling-value] {
    margin-top: 0.375rem;
    color: var(--accent);
    font-size: clamp(2.75rem, 9cqw, 4.5rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.045em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  [data-ceiling-value] span {
    margin-left: 0.25rem;
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0;
    color: var(--muted);
  }
  [data-ceiling-basis] {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--muted);
  }
  [data-rent-fit] {
    margin-top: 1.25rem;
    padding: 0.875rem;
    border-radius: 0.75rem;
    background: var(--card-2);
  }
  [data-rent-fit='within'] {
    background: var(--green-soft);
  }
  [data-rent-fit='above'] {
    background: var(--red-soft);
  }
  [data-supporting-metrics] {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 1rem;
    margin-top: 1.25rem;
    border-top: 1px solid var(--line);
    padding-top: 1.25rem;
  }
  [data-supporting-metrics] > div {
    display: contents;
  }
  [data-supporting-metrics] dt {
    grid-row: 1;
  }
  [data-supporting-metrics] dd {
    grid-row: 2;
  }
  [data-supporting-metrics] > div:first-child > * {
    grid-column: 1;
  }
  [data-supporting-metrics] > div:last-child > * {
    grid-column: 2;
  }
  [data-supporting-metrics] dd[data-buffer-note] {
    grid-row: 3;
  }
  dt {
    color: var(--muted);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  dd {
    margin-top: 0.375rem;
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  dd span {
    font-size: 0.875rem;
    font-weight: 400;
    letter-spacing: 0;
    color: var(--muted);
  }
  dd[data-buffer-note] {
    font-size: 0.8125rem;
    line-height: 1.5;
    letter-spacing: 0;
    color: var(--muted);
  }
  dd[data-buffer-note] > span {
    color: var(--red);
  }
  [data-rent-comparison] {
    margin-top: 1.5rem;
  }
  [data-scale-legend] {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--muted);
  }
  [data-scale-legend] > span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  [data-scale-legend] i:not([class]) {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--accent);
  }
  [data-scale-legend] b {
    width: 2px;
    height: 0.75rem;
    background: var(--ink);
  }
  [data-rent-scale] {
    position: relative;
    height: 0.625rem;
    margin-top: 0.75rem;
    border-radius: 1rem;
    background: var(--line);
  }
  [data-rent-amount],
  [data-rent-gap] {
    position: absolute;
    top: 0;
    height: 100%;
  }
  [data-rent-amount] {
    border-radius: 1rem 0 0 1rem;
    background: var(--accent);
  }
  [data-rent-pointer] {
    position: absolute;
    top: -0.25rem;
    width: 2px;
    height: 1.125rem;
    background: var(--ink);
  }
  [data-scale-extents] {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    color: var(--muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }
  [data-expense-prompt] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin-top: 1rem;
    color: var(--muted);
    font-size: 0.875rem;
  }
  [data-expense-prompt] button {
    min-height: 2.75rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  [data-estimate-context] {
    max-width: 72ch;
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--muted);
    line-height: 1.55;
  }
  summary {
    min-height: 2.75rem;
    padding-top: 0.875rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted);
  }
  details [data-estimate-context] {
    margin-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
  @media (max-width: 639px) {
    [data-plan-summary] {
      padding: 1.25rem;
    }
    [data-rent-fit] {
      margin-top: 1.25rem;
      padding: 0.875rem;
      border-radius: 0.75rem;
      background: var(--card-2);
    }
    [data-rent-fit='within'] {
      background: var(--green-soft);
    }
    [data-rent-fit='above'] {
      background: var(--red-soft);
    }
    [data-supporting-metrics] {
      gap: 0.75rem;
    }
    dd {
      font-size: 1.375rem;
    }
  }
</style>
