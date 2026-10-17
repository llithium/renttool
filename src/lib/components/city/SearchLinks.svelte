<script lang="ts">
  import type { City } from '$lib/types';
  import { money } from '$lib/format';
  import { buildSearchLinks } from '$lib/searchLinks';
  import { housingSearchBudget, type HousingChoice } from '$lib/planning';

  let {
    city,
    maxRent,
    housing = '1br',
    class: className = ''
  }: { city: City; maxRent: number; housing?: HousingChoice; class?: string } = $props();

  let listingCap = $derived(housingSearchBudget(maxRent, housing));
  let links = $derived(buildSearchLinks(city, maxRent, housing));
  let recommended = $derived(links.find((link) => link.provider === 'zillow'));
  let alternatives = $derived(links.filter((link) => link !== recommended));
</script>

<section class={className}>
  {#if maxRent <= 0}
    <h2 class="text-title text-ink">No room for rent within this plan</h2>
    <p class="mt-2 max-w-[58ch] text-sm/relaxed text-muted">
      Review take-home pay, expenses, savings, or your buffer before searching listings.
    </p>
  {:else}
    <div class="pb-5">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
        <div>
          <h2 class="text-title text-ink">
            Search listings under {money(listingCap)}
          </h2>
          <p class="mt-1.5 max-w-[58ch] text-sm/relaxed text-muted">
            {#if housing === 'shared-2br'}A two-bedroom up to {money(listingCap)} keeps your half within
              {money(maxRent)}/mo.
            {:else}Start with {housing === '1br' ? 'one' : 'two'}-bedroom listings within your
              target.{/if}
            Allow room for utilities, fees, and moving costs.
          </p>
        </div>

        {#if recommended}
          <a
            href={recommended.url}
            target="_blank"
            rel="noopener"
            class="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-ink no-underline transition-opacity duration-200 hover:opacity-85"
          >
            <span>Search Zillow under {money(listingCap)}</span>
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
      <div class="grid border-t border-line sm:grid-cols-3">
        {#each alternatives as link (link.provider)}
          <a
            href={link.url}
            target="_blank"
            rel="noopener"
            class="group flex min-h-18 flex-col justify-between gap-2 border-line px-0 py-4 text-sm no-underline hover:text-accent sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
          >
            <span class="font-semibold text-ink group-hover:text-accent">{link.providerName}</span>
            <span class="text-meta text-muted group-hover:text-accent">
              {#if link.prefiltered && link.capDescription}
                Listings {link.capDescription} — set bedrooms
              {:else}
                Set bedrooms and max rent
              {/if}
            </span>
          </a>
        {/each}
      </div>
    {/if}
    <p class="mt-3 max-w-[66ch] text-sm/relaxed text-muted">
      Confirm the rent, fees, and availability before you apply.
    </p>
  {/if}
</section>
