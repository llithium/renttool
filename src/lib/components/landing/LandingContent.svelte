<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { City } from '$lib/types';
  import CityHeadline from '$lib/components/city/CityHeadline.svelte';
  let { children, city }: { children?: Snippet; city: City | null } = $props();
</script>

<article aria-label="Rent plan" class="min-w-0">
  {#if city}
    <div class="city-arrival">
      <CityHeadline {city} />
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
  @media (max-width: 640px) {
    .arrival-heading {
      padding-top: 1.5rem;
    }
  }
</style>
