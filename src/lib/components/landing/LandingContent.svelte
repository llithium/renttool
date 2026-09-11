<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { City } from '$lib/types';
  import CityHeadline from '$lib/components/city/CityHeadline.svelte';
  let { children, city }: { children?: Snippet; city: City | null } = $props();
</script>

<article aria-label="Rent plan" class="min-w-0">
  {#if city}
    <div class="pb-6 md:pb-8">
      <CityHeadline {city} />
    </div>
  {:else}
    <header class="mt-3 max-w-3xl pb-8">
      <h1 class="text-display text-ink">Enter salary and city</h1>
    </header>
  {/if}

  {@render children?.()}

  {#if !city}
    <section class="mt-8 max-w-3xl pb-8" aria-labelledby="planning-heading">
      <h2 id="planning-heading" class="text-title">A starting point for your apartment search</h2>
      <p class="mt-3 text-body text-muted">
        Your target uses 30% of gross income. Compare it with local rents, then adjust for your
        other expenses, savings, and moving costs.
      </p>
      <p class="mt-3 text-body text-muted">
        We also estimate taxes and let you compare up to five cities with a different salary for
        each offer.
      </p>
    </section>
  {/if}
</article>
