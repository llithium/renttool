<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ComparisonEntry, ComparisonView } from '$lib/compare/decision';
  import type { ComparisonCity } from '$lib/compare/comparisonModel';
  import type { CompareSalaries } from '$lib/compare/salaries.svelte';
  import { housingShortLabel } from '$lib/planning';
  import { money } from '$lib/format';

  let {
    analysis,
    hrefForCity,
    salaries,
    onremove,
    editor
  }: {
    analysis: ComparisonView;
    hrefForCity: (city: ComparisonCity) => string;
    salaries: CompareSalaries;
    onremove: (name: string) => void;
    editor: Snippet<[ComparisonEntry]>;
  } = $props();

  let editingName = $state<string | null>(null);
  let hasCosts = $derived(
    analysis.entries.some(
      (entry) =>
        (entry.monthlyExpenses ?? analysis.options.monthlyExpenses) > 0 ||
        analysis.options.monthlySavings > 0
    )
  );
  let maximum = $derived(
    Math.max(1, ...analysis.entries.map((entry) => entry.metrics.after.number ?? 0))
  );
</script>

<section id="comparison-offers" aria-label="City comparison at a glance" data-comparison-summary>
  <table>
    <caption>
      {#if hasCosts}
        Available is take-home less rent, entered expenses and savings.
      {:else}
        After rent uses take-home pay; other expenses and savings excluded.
      {/if}
      {#if (analysis.options.monthlyBuffer ?? 0) > 0}Before the {money(
          analysis.options.monthlyBuffer
        )} buffer.{/if}
    </caption>
    <thead>
      <tr>
        <th scope="col">City</th>
        <th scope="col">Annual salary <span>Editable</span></th>
        <th scope="col" class="hidden lg:table-cell">Take-home <span>/ month</span></th>
        <th scope="col">{housingShortLabel(analysis.options.housing)} rent <span>/ month</span></th>
        <th scope="col">{hasCosts ? 'Available' : 'After rent'} <span>/ month</span></th>
      </tr>
    </thead>
    <tbody>
      {#each analysis.entries as entry (entry.city.name)}
        {@const inputId = `salary-${entry.city.name.replace(/[^a-z0-9]+/gi, '-')}`}
        {@const error = salaries.errors[entry.city.name] ?? ''}
        {@const editing = editingName === entry.city.name}
        <tr
          data-summary-row
          data-editing={editing}
          data-long-salary={salaries.displayed(entry.city.name, entry.salary).length > 8}
        >
          <th scope="row">
            <a href={hrefForCity(entry.city)} aria-label={`View ${entry.city.name} plan`}>
              {entry.city.name}
            </a>
            <div data-city-actions>
              <button
                type="button"
                aria-label={`${editing ? 'Close' : 'Edit'} details for ${entry.city.name}`}
                aria-expanded={editing}
                aria-controls={`details-${inputId}`}
                onclick={() => (editingName = editing ? null : entry.city.name)}
                >{editing ? 'Close details' : 'Edit details'}</button
              >
              <button
                type="button"
                aria-label={`Remove ${entry.city.name}`}
                onclick={() => onremove(entry.city.name)}
                data-remove
              >
                Remove
              </button>
            </div>
          </th>
          <td>
            <label for={inputId} data-mobile-label>Annual salary</label>
            <div
              data-salary-field
              data-long={salaries.displayed(entry.city.name, entry.salary).length > 8}
              data-invalid={Boolean(error)}
            >
              <span aria-hidden="true">$</span>
              <input
                id={inputId}
                type="text"
                inputmode="numeric"
                aria-label={`Annual salary in ${entry.city.name}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${inputId}-error` : undefined}
                value={salaries.displayed(entry.city.name, entry.salary)}
                oninput={(event) => salaries.oninput(entry.city.name, event)}
                onblur={() => salaries.commit(entry.city.name)}
              />
            </div>
            {#if error}<span id={`${inputId}-error`} data-salary-error>{error}</span>{/if}
          </td>
          <td class="hidden lg:table-cell"
            ><span data-summary-value>{entry.metrics.takehome.value.replace('/mo', '')}</span></td
          >
          <td>
            <span data-mobile-label aria-hidden="true"
              >{housingShortLabel(analysis.options.housing)} rent / mo</span
            >
            <span data-summary-value
              >{entry.metrics.selectedRent.number == null
                ? '—'
                : entry.metrics.selectedRent.value.replace('/mo', '')}</span
            >
          </td>
          <td
            data-available
            data-best={entry.metrics.after.tone === 'best'}
            data-negative={(entry.metrics.after.number ?? 0) < 0}
          >
            <span data-mobile-label aria-hidden="true"
              >{hasCosts ? 'Available' : 'After rent'} / mo</span
            >
            <strong data-summary-value>{entry.metrics.after.value.replace('/mo', '')}</strong>
            <span data-relative-track aria-hidden="true">
              <span
                style:width={`${Math.max(0, (entry.metrics.after.number ?? 0) / maximum) * 100}%`}
              ></span>
            </span>
            {#if entry.metrics.after.tone === 'best'}
              <span data-leading>Most left</span>
            {/if}
          </td>
        </tr>
        <tr data-editor-row hidden={!editing}>
          <td colspan="5" id={`details-${inputId}`}>
            {#if editing}{@render editor(entry)}{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if analysis.entries.some((entry) => entry.actualTakeHomeMonthly == null)}
    <p class="mt-3 text-sm text-muted">
      Estimated pay assumes a single filer taking the standard deduction.
    </p>
  {/if}
</section>

<style>
  [data-comparison-summary] {
    min-width: 0;
    margin-top: 1.25rem;
    padding: 1.5rem;
    border: 1px solid var(--line);
    border-radius: 1.25rem;
    background: var(--card);
    box-shadow: var(--elevation-card);
    scroll-margin-top: 6rem;
  }

  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  caption {
    padding: 0 0 0.75rem;
    caption-side: top;
    color: var(--muted);
    font-size: 0.875rem;
    line-height: 1.45;
    text-align: left;
  }

  th,
  td {
    padding: 1rem;
    border-bottom: 1px solid var(--line);
    text-align: right;
    vertical-align: top;
  }

  th:first-child {
    width: 28%;
    padding-left: 0;
    text-align: left;
  }

  th:last-child,
  td:last-child {
    padding-right: 0;
  }

  thead th {
    border-bottom-color: var(--line-strong);
    color: var(--muted);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.3;
  }

  thead span {
    display: block;
  }

  tbody th {
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-weight: 500;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  tbody a {
    color: var(--ink);
    text-decoration: underline;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 0.2em;
    text-decoration-thickness: 1px;
  }

  tbody a:hover {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  td {
    font-size: 1.25rem;
    overflow-wrap: anywhere;
  }

  [data-city-actions] {
    display: flex;
    flex-wrap: wrap;
    gap: 0 1rem;
    margin-top: 0.25rem;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  [data-city-actions] button {
    min-height: 2.75rem;
    cursor: pointer;
    color: var(--accent);
    text-underline-offset: 0.2em;
  }

  [data-city-actions] button:hover {
    text-decoration: underline;
  }

  [data-city-actions] [data-remove] {
    color: var(--muted);
  }

  [data-city-actions] [data-remove]:hover {
    color: var(--red);
  }

  [data-salary-field] {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.15rem;
    max-width: 14ch;
    margin-left: auto;
    padding-inline: 0.375rem;
    border: 1px solid var(--line-strong);
    border-radius: 0.625rem;
    background: var(--card);
  }

  [data-salary-field]:focus-within {
    border-color: var(--accent);
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  [data-salary-field][data-long='true'] input {
    font-size: 1rem;
  }

  [data-salary-field] > span {
    color: var(--muted);
    font-size: 0.875rem;
  }

  [data-salary-field] input {
    width: 100%;
    min-width: 0;
    padding: 0.25rem 0;
    background: transparent;
    outline: none;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  [data-salary-field][data-invalid='true'] {
    border-color: var(--red);
  }

  [data-salary-error] {
    display: block;
    margin-top: 0.5rem;
    color: var(--red);
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  [data-summary-value] {
    display: block;
    padding-top: 0.5rem;
  }

  [data-available] strong {
    font-weight: 700;
  }

  [data-best='true'] strong {
    color: var(--accent);
  }

  [data-negative='true'] strong {
    color: var(--red);
  }

  [data-relative-track] {
    display: block;
    max-width: 10rem;
    height: 0.25rem;
    margin-top: 0.4rem;
    margin-left: auto;
    background: var(--line);
  }

  [data-relative-track] > span {
    display: block;
    height: 100%;
    background: var(--primary);
  }

  [data-leading] {
    display: block;
    margin-top: 0.25rem;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 500;
  }

  [data-mobile-label] {
    display: none;
  }

  [data-summary-row][data-editing='true'] > * {
    border-bottom: 0;
  }

  [data-editor-row] > td {
    padding: 0 0 1.25rem;
    text-align: left;
  }

  @media (max-width: 767px) {
    [data-summary-row][data-long-salary='true'] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    [data-summary-row][data-long-salary='true'] > td:nth-child(2) {
      grid-column: 1 / -1;
    }

    [data-comparison-summary] {
      padding: 1.125rem;
    }
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    [data-summary-row] {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1fr);
      gap: 0.25rem 0.75rem;
      padding: 0.75rem 0 1rem;
      border-bottom: 1px solid var(--line);
    }

    [data-summary-row] > * {
      width: auto;
      padding: 0;
      border: 0;
      font-size: 1rem;
    }

    [data-summary-row] > th {
      display: flex;
      width: auto;
      grid-column: 1 / -1;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      font-size: 1.125rem;
    }

    [data-city-actions] {
      flex-wrap: nowrap;
      gap: 0.75rem;
      margin: 0;
      font-size: 0.8125rem;
    }

    [data-salary-field] {
      max-width: none;
    }

    [data-salary-field] input {
      font-size: 1rem;
    }

    [data-salary-field][data-long='true'] input {
      font-size: 1rem;
    }

    [data-mobile-label] {
      display: block;
      color: var(--muted);
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    [data-summary-value] {
      padding-top: 0.75rem;
    }

    [data-editor-row] > td {
      display: block;
    }
  }

  @media (max-width: 359px) {
    [data-summary-row] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    [data-summary-row] > td:nth-child(2) {
      grid-column: 1 / -1;
    }
  }
</style>
