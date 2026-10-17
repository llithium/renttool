<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { housingRent, housingShortLabel } from '$lib/planning';
  import { money } from '$lib/format';
  let { presentation }: { presentation: RentPlanPresentation } = $props();
  let budget = $derived(presentation.budget);
  let city = $derived(presentation.activeCity);
  let ceiling = $derived(presentation.rentTarget);
  let rent = $derived(city ? housingRent(city, presentation.options.housing) : null);
  let available = $derived(presentation.spendingRoom?.available);
  let fits = $derived(rent != null && ceiling != null ? rent <= ceiling : null);
  let usesGrossTarget = $derived(budget != null && ceiling === budget.maxRent);
  let spendingLabel = $derived(
    presentation.options.monthlyExpenses > 0
      ? presentation.options.monthlySavings > 0
        ? 'After rent, expenses & savings'
        : 'After rent & expenses'
      : presentation.options.monthlySavings > 0
        ? 'After rent & savings'
        : 'After rent'
  );
</script>

{#if city}
  <section aria-label="Plan summary" class="@container min-w-0" data-testid="plan-summary">
    {#if budget}
      <dl class="grid grid-cols-1 gap-x-4 gap-y-2 @2xs:grid-cols-2 @md:grid-cols-3">
        <div class="row-span-2 grid grid-rows-subgrid">
          <dt class="text-label text-muted">
            {usesGrossTarget ? '30% of gross income' : 'Personal rent ceiling'}
          </dt>
          <dd
            class="self-baseline text-[clamp(2rem,3vw,2.75rem)] leading-tight font-semibold tracking-tight text-ink tabular-nums"
          >
            {money(ceiling)}<span class="text-sm text-muted">/mo</span>
          </dd>
        </div>
        <div class="row-span-2 grid grid-rows-subgrid">
          <dt class="text-label text-muted">
            Local {housingShortLabel(presentation.options.housing)} estimate
          </dt>
          <dd class="self-baseline text-2xl/tight font-semibold tracking-tight tabular-nums">
            {money(rent)}<span class="text-sm text-muted">/mo</span>
          </dd>
        </div>
        <div class="row-span-2 grid grid-rows-subgrid @2xs:col-span-2 @md:col-span-1">
          <dt class="text-label text-muted">{spendingLabel}</dt>
          <dd
            class="self-baseline text-2xl/tight font-semibold tracking-tight tabular-nums {available !=
              null && available < 0
              ? 'text-red'
              : 'text-ink'}"
          >
            {money(available)}<span class="text-sm text-muted">/mo</span>
            {#if available != null && (presentation.options.monthlyBuffer ?? 0) > 0 && (presentation.options.monthlyBuffer ?? 0) > available}
              <p class="mt-1 text-meta text-red">
                Buffer shortfall: {money((presentation.options.monthlyBuffer ?? 0) - available)}/mo
              </p>
            {/if}
          </dd>
        </div>
      </dl>
      <p
        class="mt-4 inline-block rounded-full px-3 py-1.5 text-meta font-medium {fits == null
          ? 'text-muted'
          : fits
            ? 'bg-green-soft text-green'
            : 'bg-red-soft text-red'}"
      >
        {fits == null
          ? 'Local rent estimate unavailable'
          : fits
            ? usesGrossTarget
              ? 'Local rent fits your 30% target'
              : 'Local rent fits your ceiling'
            : usesGrossTarget
              ? 'Local rent exceeds your 30% target'
              : 'Local rent exceeds your ceiling'}
      </p>
      <p class="mt-3 text-meta text-muted">
        {usesGrossTarget
          ? 'Using 30% of gross income.'
          : `Limited by take-home pay after your costs and goals, capped at ${money(budget.maxRent)} (30% of gross income).`}
        {#if (presentation.options.monthlyBuffer ?? 0) > 0}Buffer target: {money(
            presentation.options.monthlyBuffer
          )}/mo.{/if}
        {presentation.actualTakeHomeMonthly != null
          ? 'Spending room uses entered take-home pay.'
          : 'Spending room uses estimated take-home pay.'}
      </p>
    {:else}
      <h2 class="text-title">What rent fits here?</h2>
      <p class="mt-2 max-w-sm text-sm text-muted">
        Enter your annual salary below to see your ceiling, local rent, and spending room.
      </p>
    {/if}
  </section>
{/if}
