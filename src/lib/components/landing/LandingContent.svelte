<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { City } from '$lib/types';
  import CityImage from '$lib/components/city/CityImage.svelte';
  import CityHeadline from '$lib/components/city/CityHeadline.svelte';
  let { children, city }: { children?: Snippet; city: City | null } = $props();
</script>

<article aria-label="Rent plan" class="min-w-0">
  {#if city}
    <div class="city-arrival">
      <CityHeadline {city} />
      {#key city.name}<CityImage {city} class="arrival-photo" />{/key}
    </div>
  {:else}
    <header class="arrival-heading">
      <h1>Find your next place.</h1>
      <p>Explore cities. See what your salary makes possible.</p>
    </header>
  {/if}

  {@render children?.()}
</article>

<style>
  .arrival-heading {
    padding: 2.5rem 0 2rem;
    max-width: 55rem;
  }
  .arrival-heading h1 {
    font-size: clamp(2.5rem, 5.5vw, 5rem);
    font-weight: 650;
    line-height: 1.06;
    letter-spacing: -0.055em;
  }
  .arrival-heading p {
    margin-top: 1.25rem;
    font-size: 1.2rem;
    color: var(--muted);
  }
  .city-arrival {
    display: grid;
    gap: 1.5rem;
    margin: 1.5rem 0;
  }
  .city-arrival :global(.arrival-photo) {
    border: 0;
    border-radius: 1.25rem;
  }
  .city-arrival :global(.arrival-photo img) {
    max-height: 24rem;
    aspect-ratio: 3.5;
  }
  @media (max-width: 640px) {
    .arrival-heading {
      padding-top: 1.5rem;
    }
    .city-arrival :global(.arrival-photo img) {
      aspect-ratio: 1.65;
    }
  }
</style>
