<script lang="ts">
  import { tick } from 'svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import type { SalaryField as SalaryFieldState } from '$lib/salaryField.svelte';
  import type { City } from '$lib/types';
  import { fetchPlaceSummary, splitLead } from '$lib/wikipedia';
  import ApartmentCheck from '$lib/components/city/ApartmentCheck.svelte';
  import TopBar from './TopBar.svelte';
  import PlaceSearch from './PlaceSearch.svelte';
  import SalaryField from './SalaryField.svelte';
  import HousingToggle from './HousingToggle.svelte';
  import ShareMenu from './ShareMenu.svelte';
  import CityPostcard from './CityPostcard.svelte';
  import MoneySection from './MoneySection.svelte';
  import CostsSection from './CostsSection.svelte';
  import NearbyTowns from './NearbyTowns.svelte';
  import LivingThere from './LivingThere.svelte';
  import ListingLinks from './ListingLinks.svelte';
  import SiteFooter from './SiteFooter.svelte';

  let {
    presentation,
    city,
    salary,
    apartmentOpen = $bindable(false)
  }: {
    presentation: RentPlanPresentation;
    city: City;
    salary: SalaryFieldState;
    apartmentOpen?: boolean;
  } = $props();

  let costsOpen = $state(false);
  let summary = $state<{ name: string; first: string; rest: string; url: string } | null>(null);
  let comparing = $derived(presentation.isComparing(city.name));
  let comparePending = $derived(presentation.isComparisonPending(city.name));
  let compareCount = $derived(presentation.comparisonNames.length);
  let story = $derived(summary?.name === city.name ? summary : null);

  $effect(() => {
    const { name, city: cityName, state } = city;
    let live = true;
    void fetchPlaceSummary({ city: cityName, state }).then((result) => {
      if (!live) return;
      summary = result ? { name, ...splitLead(result.extract), url: result.url } : null;
    });
    return () => {
      live = false;
    };
  });

  async function editCosts() {
    costsOpen = true;
    await tick();
    const field = document.getElementById('plan-expenses');
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    field?.focus({ preventScroll: true });
  }

  async function toggleCompare() {
    if (comparing) presentation.removeComparison(city.name);
    else await presentation.addComparison(city.name);
  }
</script>

<div class="pc-wrap">
  <TopBar homeHref="/">
    <div class="pc-top-city">
      <PlaceSearch
        onselect={(suggestion) => void presentation.chooseCity(suggestion)}
        selectedName={presentation.selectedName}
        pendingName={presentation.pendingName}
        housing={presentation.options.housing}
      />
    </div>
    <SalaryField field={salary} />
    <HousingToggle
      value={presentation.options.housing}
      onchange={(housing) => presentation.setOptions({ ...presentation.options, housing })}
    />
    {#snippet end()}
      <button
        type="button"
        class="pc-btn {comparing ? '' : 'pc-btn-dark'}"
        onclick={toggleCompare}
        disabled={comparePending || (!comparing && presentation.comparisonFull)}
        aria-pressed={comparing}
        >{comparing
          ? 'In your comparison'
          : presentation.comparisonFull
            ? 'Comparison full'
            : 'Add to compare'}</button
      >
      <a
        class="pc-btn"
        href={presentation.buildHref('/compare')}
        aria-label={compareCount
          ? `Compare ${compareCount} ${compareCount === 1 ? 'city' : 'cities'}`
          : undefined}
        >Compare{#if compareCount}<span class="pc-top-count">{compareCount}</span>{/if}</a
      >
      <ShareMenu {presentation} />
    {/snippet}
  </TopBar>

  <CityPostcard {presentation} {city} lead={story?.first ?? null} oneditcosts={editCosts} />

  <MoneySection {presentation} {city} />

  {#if presentation.budget}
    <CostsSection
      bind:open={costsOpen}
      options={presentation.options}
      onoptions={(options) => presentation.setOptions(options)}
      actualTakeHomeMonthly={presentation.actualTakeHomeMonthly}
      ontakehome={(value) => presentation.setActualTakeHome(value)}
      grossCeiling={presentation.budget.maxRent}
      ceiling={presentation.rentTarget}
    />
  {/if}

  <NearbyTowns {presentation} {city} />

  <LivingThere
    {city}
    story={story ? story.rest || story.first : null}
    articleUrl={story?.url ?? null}
  />

  <ListingLinks {city} ceiling={presentation.rentTarget} housing={presentation.options.housing} />

  {#if presentation.budget}
    {#key `${city.name}:${presentation.options.housing}`}
      <ApartmentCheck {presentation} bind:open={apartmentOpen} />
    {/key}
  {/if}

  <SiteFooter />
</div>

<style>
  .pc-top-city {
    min-width: 0;
  }
  .pc-top-count {
    display: inline-flex;
    min-width: 1.375rem;
    height: 1.375rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--pink);
    color: var(--navy);
    font-size: 0.75rem;
  }
  @media (max-width: 760px) {
    .pc-top-city {
      flex: 1 1 100%;
    }
    .pc-top-city :global(.pc-search-field) {
      width: 100%;
    }
  }
</style>
