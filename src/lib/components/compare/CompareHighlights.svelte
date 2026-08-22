<script lang="ts">
  import {
    DECISION_CRITERIA,
    type ComparisonCity,
    type ComparisonView,
    type DecisionCriterion
  } from '$lib/compare/decision';

  let {
    analysis,
    hrefForCity
  }: { analysis: ComparisonView; hrefForCity: (city: ComparisonCity) => string } = $props();
  let criterion = $state<DecisionCriterion>('afterRent');
  let decision = $derived(analysis.briefs[criterion]);
</script>

<section class="mt-24 border-t border-line-strong pt-8 md:mt-32" aria-labelledby="decision-heading">
  <div class="flex flex-col justify-between gap-5 md:flex-row md:items-end">
    <div class="max-w-xl">
      <h2 id="decision-heading" class="text-[clamp(2.5rem,5vw,5rem)] leading-none tracking-tighter">
        Decision brief
      </h2>
      <p class="mt-1 text-sm/relaxed text-muted">
        Choose what matters most for this move. The result uses the salaries shown in each
        comparison entry.
      </p>
    </div>
    <div class="flex flex-wrap gap-2" aria-label="Decision criterion">
      {#each DECISION_CRITERIA as option (option.key)}
        <button
          type="button"
          aria-pressed={criterion === option.key}
          onclick={() => (criterion = option.key)}
          class="cursor-pointer border px-3 py-2 text-sm font-semibold transition-colors {criterion ===
          option.key
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-line-strong bg-card text-ink hover:border-accent hover:text-accent'}"
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>

  {#key `${criterion}-${decision.leaders.map((leader) => leader.city.name).join('|')}-${decision.detail}`}
    <div
      class="motion-copy mt-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
    >
      <div>
        <span class="block text-label tracking-wide text-muted uppercase">{decision.title}</span>
        {#if decision.leaders.length}
          <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {#each decision.leaders as leader, index (leader.city.name)}
              {#if index > 0}<span class="text-data text-muted">and</span>{/if}
              <a
                href={hrefForCity(leader.city)}
                class="inline-block text-data text-ink decoration-accent underline-offset-4 hover:text-accent"
              >
                {leader.city.name}
              </a>
            {/each}
          </div>
        {:else}
          <strong class="mt-1 block text-data text-ink">Not enough data yet</strong>
        {/if}
      </div>
      <p class="max-w-sm text-sm/relaxed text-muted tabular-nums sm:text-right">
        {decision.detail}
      </p>
    </div>
  {/key}
</section>
