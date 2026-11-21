<script lang="ts">
  import type { City } from '$lib/types';
  import type { HousingChoice } from '$lib/planning';
  import { buildSearchLinks } from '$lib/searchLinks';

  let { city, ceiling, housing }: { city: City; ceiling: number | null; housing: HousingChoice } =
    $props();

  let links = $derived(buildSearchLinks(city, ceiling ?? 0, housing));
</script>

<section class="pc-section" aria-labelledby="listings-heading" id="listing-search">
  <h2 id="listings-heading" class="pc-h2">See what's listed</h2>
  <p class="pc-lede">
    {ceiling != null
      ? 'Apartments.com and Zillow open already filtered to your ceiling. Zumper and HotPads open to the city.'
      : 'Each site opens to the city. Add a salary and the first two filter to your ceiling.'}
  </p>
  <div class="pc-listings">
    {#each links as link (link.provider)}
      <a
        class="pc-btn pc-btn-dark pc-btn-lg"
        href={ceiling == null ? link.url.split('?')[0] : link.url}
        target="_blank"
        rel="noopener"
        data-provider={link.provider}
        >{link.providerName}{ceiling != null && link.capDescription
          ? `, ${link.capDescription}`
          : ''}</a
      >
    {/each}
  </div>
</section>

<style>
  .pc-listings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  @media (max-width: 600px) {
    .pc-listings a {
      flex: 1 1 100%;
    }
  }
</style>
