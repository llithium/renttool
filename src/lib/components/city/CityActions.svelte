<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import SharePlan from '$lib/components/ui/SharePlan.svelte';

  let { presentation, cityName }: { presentation: RentPlanPresentation; cityName: string } =
    $props();

  let comparing = $derived(presentation.isComparing(cityName));
  let compareFull = $derived(!comparing && presentation.comparisonFull);

  async function onCompare() {
    if (presentation.isComparing(cityName)) {
      presentation.removeComparison(cityName);
      return;
    }
    await presentation.addComparison(cityName);
  }
</script>

<!-- Secondary actions share the input deck's footer. -->
<div class="flex flex-wrap items-start gap-2 md:gap-x-4">
  <button
    type="button"
    aria-pressed={comparing}
    disabled={compareFull}
    title={compareFull ? 'Remove a city before adding another' : undefined}
    onclick={onCompare}
    class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1 py-2 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-55 {comparing
      ? 'text-ink'
      : 'text-accent hover:text-accent-deep'}"
  >
    {#if comparing}
      <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="m3.5 8.25 2.75 2.75L12.5 5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      In compare
    {:else if compareFull}
      Comparison full
    {:else}
      + Compare
    {/if}
  </button>
  <button
    type="button"
    onclick={() => {
      presentation.exploreCities();
      document.getElementById('main-content')?.scrollIntoView({ behavior: 'instant' });
    }}
    class="min-h-11 cursor-pointer rounded-md px-1 py-2 text-sm font-semibold text-accent"
    >Explore other cities</button
  >
  <SharePlan {presentation} />
  {#if presentation.comparisonNames.length}
    <a
      href="#comparison-section"
      class="inline-flex min-h-11 items-center rounded-md px-1 py-2 text-sm font-semibold text-accent no-underline hover:bg-accent-soft hover:text-accent-deep"
    >
      View comparison ({presentation.comparisonNames.length})
    </a>
  {/if}
</div>
