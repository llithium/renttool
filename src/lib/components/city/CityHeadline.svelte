<script lang="ts">
  import type { City, RentSource } from '$lib/types';

  // Which dataset the headline rent came from — shown beside the city headline,
  // which owns the page-title role that CityFacts' card header used to.
  const SOURCE_LABEL: Record<RentSource, string> = {
    'apartment-list': 'Apartment List estimate',
    'hud-fmr': 'HUD Fair Market Rent',
    none: 'No rent data'
  };

  let { city, class: className = '' }: { city: City; class?: string } = $props();
</script>

<header class={className}>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <h1 class="max-w-5xl text-display text-ink">
      {city.name}
    </h1>
    <span class="pb-2 text-meta text-muted">{SOURCE_LABEL[city.source]}</span>
  </div>
</header>
