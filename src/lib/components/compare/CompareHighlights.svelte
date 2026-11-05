<script lang="ts">
  import Select from '$lib/components/ui/Select.svelte';
  import {
    DECISION_CRITERIA,
    type ComparisonView,
    type DecisionCriterion
  } from '$lib/compare/decision';
  import type { ComparisonCity } from '$lib/compare/comparisonModel';
  import { housingShortLabel } from '$lib/planning';
  import { money } from '$lib/format';

  let {
    analysis,
    hrefForCity
  }: { analysis: ComparisonView; hrefForCity: (city: ComparisonCity) => string } = $props();
  let criterion = $state<DecisionCriterion>('afterRent');
  let hasPersonalCosts = $derived(
    analysis.entries.some(
      (entry) =>
        (entry.monthlyExpenses ?? analysis.options.monthlyExpenses) > 0 ||
        analysis.options.monthlySavings > 0
    )
  );
  let decision = $derived(analysis.briefs[criterion]);
  let alternative = $derived.by(() => {
    const definition = DECISION_CRITERIA.find((option) => option.key === criterion);
    if (!definition || !decision.leaders.length) return null;
    const leaders = new Set(decision.leaders.map((entry) => entry.city.name));
    const candidates = analysis.entries.filter(
      (entry) => !leaders.has(entry.city.name) && entry.metrics[definition.metricKey].number != null
    );
    const direction = criterion === 'rent' ? 1 : -1;
    candidates.sort(
      (left, right) =>
        direction *
        ((left.metrics[definition.metricKey].number ?? 0) -
          (right.metrics[definition.metricKey].number ?? 0))
    );
    const next = candidates[0];
    const leadingValue = decision.leaders[0]?.metrics[definition.metricKey].number;
    const nextValue = next?.metrics[definition.metricKey].number;
    return next && leadingValue != null && nextValue != null
      ? {
          name: next.city.name,
          difference: money(Math.abs(leadingValue - nextValue)),
          comparison:
            criterion === 'rent'
              ? 'lower monthly rent'
              : criterion === 'takeHome'
                ? 'more monthly take-home pay'
                : 'more monthly spending room'
        }
      : null;
  });
</script>

<section data-decision-brief aria-labelledby="decision-heading">
  <div data-brief-header>
    <h2 id="decision-heading" tabindex="-1">Decision brief</h2>
    <div data-criterion-control>
      <Select
        id="decision-criterion"
        label="Decision criterion"
        hideLabel
        value={criterion}
        options={DECISION_CRITERIA.map((option) => ({
          value: option.key,
          label:
            option.key === 'afterRent' && hasPersonalCosts
              ? 'Most available each month'
              : option.label.replace('1BR', housingShortLabel(analysis.options.housing))
        }))}
        onchange={(value) => (criterion = value)}
      />
    </div>
  </div>
  {#if analysis.qualification}<p data-qualification>
      {analysis.qualification}
    </p>{/if}
  {#key `${criterion}-${decision.leaders.map((leader) => leader.city.name).join('|')}-${decision.detail}`}
    <div data-decision-outcome>
      <div data-decision-difference>
        {#if alternative}
          <strong data-decision-amount data-long={alternative.difference.length > 5}
            >{alternative.difference}</strong
          >
          <p>{alternative.comparison}</p>
          <p>than <span>{alternative.name}</span></p>
        {:else}
          <p data-decision-label>{decision.title}</p>
          <p data-standalone-detail>{decision.detail}</p>
        {/if}
      </div>
      <div data-leading-city>
        <p data-decision-label>{decision.title}</p>
        {#if decision.leaders.length}
          <div data-leader-links>
            {#each decision.leaders as leader, index (leader.city.name)}
              {#if index > 0}<span>and</span>{/if}
              <a href={hrefForCity(leader.city)} data-decision-city>{leader.city.name}</a>
            {/each}
          </div>
        {:else}<strong>Not enough data yet</strong>{/if}
        {#if alternative}<p data-absolute-outcome>{decision.detail}</p>{/if}
      </div>
    </div>
  {/key}
</section>

<style>
  [data-decision-brief] :global(a:focus-visible),
  [data-criterion-control] :global(button:focus-visible) {
    outline-color: white;
  }

  [data-decision-brief] {
    margin-top: 1.5rem;
    padding: 1.75rem 2rem;
    border-radius: 1.25rem;
    background: var(--decision-bg);
    color: var(--decision-ink);
  }
  [data-brief-header] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  #decision-heading {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--decision-muted);
    scroll-margin-top: 6rem;
  }
  [data-criterion-control] {
    width: 19rem;
    min-width: 0;
  }
  [data-decision-outcome] {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: end;
    gap: 2.5rem;
    margin-top: 1.5rem;
  }
  [data-decision-amount] {
    display: block;
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.045em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  [data-decision-difference] p {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--decision-muted);
  }
  [data-decision-difference] p + p {
    margin-top: 0.125rem;
  }
  [data-decision-difference] p span {
    font-weight: 600;
    color: var(--decision-ink);
  }
  [data-decision-label] {
    font-size: 0.8125rem;
    color: var(--decision-muted);
  }
  [data-leader-links] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    margin-top: 0.375rem;
  }
  [data-decision-city] {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: -0.025em;
    color: white;
    text-decoration: underline;
    text-underline-offset: 0.15em;
    text-decoration-color: #a9bbff;
    text-decoration-thickness: 1px;
  }
  [data-decision-city]:hover {
    text-decoration-color: white;
  }
  [data-absolute-outcome] {
    max-width: 40ch;
    margin-top: 0.75rem;
    color: var(--decision-muted);
    font-size: 0.875rem;
    line-height: 1.55;
  }
  [data-qualification] {
    margin-top: 1rem;
    padding-left: 0.75rem;
    border-left: 2px solid #a9bbff;
    color: var(--decision-muted);
    font-size: 0.875rem;
  }
  [data-decision-difference] [data-standalone-detail] {
    font-size: 1.25rem;
    color: white;
  }
  @media (max-width: 639px) {
    [data-decision-brief] {
      padding: 1.25rem;
    }
    #decision-heading {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    [data-criterion-control] {
      width: 100%;
    }
    [data-decision-outcome] {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
      margin-top: 1.25rem;
    }
    [data-decision-amount] {
      font-size: 2.5rem;
    }
    [data-decision-amount][data-long='true'] {
      font-size: 1.5rem;
    }
    [data-decision-difference] p,
    [data-absolute-outcome] {
      font-size: 0.8125rem;
    }
    [data-leading-city] [data-decision-label] {
      display: none;
    }
    [data-decision-city] {
      font-size: 1.375rem;
    }
    [data-leader-links] {
      margin-top: 0;
    }
    [data-absolute-outcome] {
      margin-top: 0.5rem;
    }
  }
</style>
