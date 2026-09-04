<script lang="ts">
  import type { City } from '$lib/types';
  import { money } from '$lib/format';
  import { buildSearchLinks } from '$lib/searchLinks';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';

  let {
    city,
    maxRent,
    class: className = ''
  }: { city: City; maxRent: number; class?: string } = $props();

  let links = $derived(buildSearchLinks(city, maxRent));
  let recommended = $derived(links.find((link) => link.provider === 'zillow'));
  let alternatives = $derived(links.filter((link) => link !== recommended));
</script>

<section class={className}>
  <SectionHeading title="Next step" />

  <div class="border-y border-line py-5 sm:py-6">
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
      <div>
        <h3 class="text-title text-ink">
          Search listings under {money(maxRent)}
        </h3>
        <p class="mt-1.5 max-w-[58ch] text-sm/relaxed text-muted">
          We pass your exact rent cap to Zillow. Other marketplaces are here if you want a wider
          look; each link states whether it carries a rent cap with it.
        </p>
      </div>

      {#if recommended}
        <a
          href={recommended.url}
          target="_blank"
          rel="noopener"
          class="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink no-underline shadow-card transition duration-200 hover:-translate-y-px hover:bg-accent-deep hover:shadow-pop active:translate-y-0 active:shadow-card"
        >
          <span>Search Zillow under {money(maxRent)}</span>
          <svg class="size-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.25 12.75 12.75 3.25M6 3.25h6.75V10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      {/if}
    </div>
  </div>

  {#if alternatives.length}
    <div class="grid border-b border-line sm:grid-cols-3">
      {#each alternatives as link (link.provider)}
        <a
          href={link.url}
          target="_blank"
          rel="noopener"
          class="group flex min-h-22 flex-col justify-between gap-2 border-b border-line px-0 py-4 text-sm no-underline hover:text-accent sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
        >
          <span class="font-semibold text-ink group-hover:text-accent">{link.providerName}</span>
          <span class="text-meta text-muted group-hover:text-accent">
            {#if link.prefiltered && link.capDescription}
              Shows listings {link.capDescription}
            {:else}
              Browse listings — set your max rent
            {/if}
          </span>
        </a>
      {/each}
    </div>
  {/if}
  <p class="mt-3 max-w-[66ch] text-sm/relaxed text-muted">
    Apartment budgets are planning estimates. Confirm the rent, fees, and availability before you
    apply.
  </p>
</section>
