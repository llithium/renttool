<script lang="ts">
  import type { City, RentSource } from '$lib/types';

  // Which dataset the headline rent came from — shown beside the city headline,
  // which owns the page-title role that CityFacts' card header used to.
  const SOURCE_LABEL: Record<RentSource, string> = {
    'apartment-list': 'Apartment List estimate',
    'hud-fmr': 'HUD Fair Market Rent',
    none: 'No rent data'
  };

  let {
    city,
    onedit,
    class: className = ''
  }: { city: City; onedit?: () => void; class?: string } = $props();
</script>

<header class={className}>
  <div class="flex flex-col items-start gap-2">
    <div class="flex w-full items-center justify-between gap-3">
      <h1 class="min-w-0 text-display text-ink">{city.name}</h1>
      <a
        href="#plan-controls"
        onclick={onedit}
        aria-label="Edit salary and housing"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-deep"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
          ><path
            d="m10.5 2.5 3 3M3 10l7.6-7.6a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L6 13H3v-3Z"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          /></svg
        >
        Edit plan
      </a>
    </div>
    <span class="max-w-full pb-1 text-meta wrap-break-word text-muted"
      >{SOURCE_LABEL[city.source]}{city.rentYear ? ` · ${city.rentYear}` : ''}</span
    >
  </div>
</header>
