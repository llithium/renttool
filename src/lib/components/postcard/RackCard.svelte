<script lang="ts">
  import type { City } from '$lib/types';
  import type { ComparisonEntry as ViewEntry } from '$lib/compare/decision';
  import type { CompareSalaries } from '$lib/compare/salaries.svelte';
  import { money } from '$lib/format';
  import { housingWords, readRent } from '$lib/postcard';
  import type { HousingChoice } from '$lib/planning';
  import MonthlyAmountInput from '$lib/components/ui/MonthlyAmountInput.svelte';
  import CityFront from './CityFront.svelte';
  import Stamp from './Stamp.svelte';

  /** One city in the compare rack: its own offer, stamp, and pay. */
  let {
    city,
    entry,
    salaries,
    housing,
    leadLabel = null,
    hasCosts,
    href,
    onremove,
    onexpenses,
    ontakehome
  }: {
    city: City;
    entry: ViewEntry;
    salaries: CompareSalaries;
    housing: HousingChoice;
    leadLabel?: string | null;
    hasCosts: boolean;
    href: string;
    onremove: () => void;
    onexpenses: (value: number | null) => void;
    ontakehome: (value: number | null) => void;
  } = $props();

  const id = $props.id();
  let words = $derived(housingWords(housing));
  let rent = $derived(entry.rent.amount);
  let ceiling = $derived(entry.rentBudget.amount);
  let reading = $derived(readRent(rent, ceiling));
  let takeHome = $derived(entry.metrics.takehome.number);
  let left = $derived(entry.metrics.after.number);
  let error = $derived(salaries.errors[city.name]);
</script>

<article
  class="pc-card pc-rack"
  data-lead={leadLabel ? 'true' : 'false'}
  aria-label={city.name}
  data-testid="rack-card"
>
  <CityFront place={city} variant="mini" heading="h2">
    {#snippet badge()}{#if leadLabel}<span class="pc-rack-badge">{leadLabel}</span>{/if}{/snippet}
  </CityFront>
  <div class="pc-rack-back">
    <label class="pc-rack-offer" for={`${id}-salary`}>
      <span>Offer</span>
      <span class="pc-rack-offer-input"
        >$<input
          id={`${id}-salary`}
          type="text"
          inputmode="numeric"
          autocomplete="off"
          aria-label={`Salary offer in ${city.name}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-salary-error` : undefined}
          value={salaries.displayed(city.name, entry.salary)}
          oninput={(event) => salaries.oninput(city.name, event)}
          onblur={() => salaries.commit(city.name)}
          onkeydown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        /></span
      >
    </label>
    {#if error}<p id={`${id}-salary-error`} class="pc-rack-error" role="status">{error}</p>{/if}
    <Stamp
      size={124}
      fit={reading.fit}
      share={reading.share}
      description={rent == null
        ? `No ${words.short} rent estimate`
        : `${words.rent} uses ${reading.percentLabel} of the ${money(ceiling)} ceiling`}
    />
    <p class="pc-rack-rent pc-display">{money(rent)}</p>
    <p class="pc-rack-of">{words.rent}{ceiling != null ? ` of a ${money(ceiling)} ceiling` : ''}</p>
    <p class="pc-rack-verdict pc-display">{reading.shortVerdict}</p>
    <dl>
      <div>
        <dt>Take-home</dt>
        <dd>{money(takeHome)}</dd>
      </div>
      <div>
        <dt>{hasCosts ? 'Left after costs' : 'Left after rent'}</dt>
        <dd>{money(left)}</dd>
      </div>
    </dl>
    <details class="pc-rack-more">
      <summary>Pay and costs for this city</summary>
      <MonthlyAmountInput
        id={`${id}-take-home`}
        label="Actual take-home"
        value={entry.actualTakeHomeMonthly ?? null}
        onchange={ontakehome}
        hint="Blank uses estimated taxes."
      />
      <MonthlyAmountInput
        id={`${id}-expenses`}
        label="Expenses here"
        value={entry.monthlyExpenses ?? null}
        onchange={onexpenses}
        hint="Blank uses your usual expenses."
      />
    </details>
    <div class="pc-rack-acts">
      <a {href}>City page</a>
      <button type="button" onclick={onremove} aria-label={`Remove ${city.name}`}>Remove</button>
    </div>
  </div>
</article>

<style>
  .pc-rack {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
  }
  .pc-rack[data-lead='true'] {
    outline: 4px solid var(--pink);
  }
  .pc-rack-badge {
    display: inline-block;
    padding: 0.375rem 0.625rem;
    border-radius: 999px;
    background: var(--pink);
    color: var(--navy);
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .pc-rack-back {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    padding: 1.125rem 1.125rem 1rem;
    text-align: center;
  }
  .pc-rack-offer {
    display: flex;
    width: 100%;
    min-height: 2.75rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0 0.875rem;
    border-radius: 999px;
    background: var(--card-2);
    color: var(--muted);
    font-size: 0.875rem;
  }
  .pc-rack-offer:focus-within {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }
  .pc-rack-offer-input {
    display: inline-flex;
    align-items: baseline;
    color: var(--navy);
    font-size: 1rem;
    font-weight: 700;
  }
  .pc-rack-offer input {
    width: 5.75rem;
    min-width: 3ch;
    field-sizing: content;
    border: 0;
    background: transparent;
    color: var(--navy);
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: right;
    outline: none;
  }
  .pc-rack-error {
    margin: -0.5rem 0 0.75rem;
    color: var(--red);
    font-size: 0.8125rem;
  }
  .pc-rack-rent {
    margin: 0.75rem 0 0;
    font-size: 2.25rem;
    font-weight: 800;
    line-height: 1;
  }
  .pc-rack-of {
    margin: 0.25rem 0 0;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .pc-rack-verdict {
    margin: 0.75rem 0 0;
    font-size: 1.1875rem;
    font-weight: 700;
  }
  dl {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.625rem;
    margin: 1rem 0 0;
    padding-top: 0.875rem;
    border-top: 1.5px solid var(--navy);
  }
  dt {
    color: var(--muted);
    font-size: 0.75rem;
  }
  dd {
    margin: 0.125rem 0 0;
    font-size: 1.125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .pc-rack-more {
    width: 100%;
    margin-top: 0.75rem;
    text-align: left;
  }
  .pc-rack-more summary {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    color: var(--muted);
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .pc-rack-more[open] {
    display: grid;
    gap: 0.75rem;
  }
  .pc-rack-acts {
    display: flex;
    width: 100%;
    gap: 0.5rem;
    margin-top: auto;
    padding-top: 0.75rem;
  }
  .pc-rack-acts a,
  .pc-rack-acts button {
    display: inline-flex;
    min-height: 2.75rem;
    flex: 1;
    align-items: center;
    justify-content: center;
    border: 1.5px solid #c5cdd5;
    border-radius: 999px;
    background: #fff;
    color: var(--navy);
    font-size: 0.8125rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }
  .pc-rack-acts a:hover,
  .pc-rack-acts button:hover {
    border-color: var(--navy);
  }
</style>
