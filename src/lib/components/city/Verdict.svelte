<script lang="ts">
  import type { Budget, City } from '$lib/types';
  import { money } from '$lib/format';
  import { housingRent, type HousingChoice } from '$lib/planning';

  let {
    budget,
    city,
    housing = '1br',
    target = budget.maxRent,
    personal = false
  }: {
    budget: Budget;
    city: City;
    housing?: HousingChoice;
    target?: number;
    personal?: boolean;
  } = $props();
  let rent = $derived(housingRent(city, housing));
  let gap = $derived(rent != null ? target - rent : null);
</script>

{#if gap != null}
  <section aria-labelledby="affordability-heading" class="flex items-start gap-3">
    <span aria-hidden="true" class="mt-0.5 shrink-0 {gap >= 0 ? 'text-green' : 'text-red'}">
      <svg class="size-5" viewBox="0 0 24 24" fill="none">
        {#if gap >= 0}
          <path
            d="m5 12.5 4.5 4.5L19 7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {:else}
          <path
            d="M12 8v5m0 3.5v.01M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {/if}
      </svg>
    </span>
    <div>
      <h2
        id="affordability-heading"
        class="text-base font-semibold lg:text-title {gap >= 0 ? 'text-green' : 'text-red'}"
      >
        {gap >= 0
          ? personal
            ? 'Fits your personal rent ceiling'
            : 'Fits your 30% gross-income target'
          : personal
            ? 'Above your personal rent ceiling'
            : 'Above your gross-income target'}
      </h2>
      <p class="mt-1 max-w-[68ch] text-sm text-muted">
        Typical {housing === 'shared-2br'
          ? 'rent for your half of a shared 2BR'
          : housing === '2br'
            ? '2BR rent'
            : '1BR rent'} is
        <strong class="font-semibold text-ink"
          >{money(Math.abs(gap))}/mo {gap >= 0 ? 'below' : 'above'} your ceiling.</strong
        >
        {#if gap < 0}Try nearby places, a roommate, or a lower-rent apartment.{/if}
      </p>
    </div>
  </section>
{:else}
  <p class="text-sm text-muted">
    No rent estimate is available for this housing setup. You can still search listings within your
    target.
  </p>
{/if}
