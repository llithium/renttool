<script lang="ts">
  import { tick } from 'svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import SharePlan from '$lib/components/ui/SharePlan.svelte';
  import { cityIdentity } from '$lib/cityIdentity';
  import { money } from '$lib/format';

  let { presentation, cityName }: { presentation: RentPlanPresentation; cityName: string } =
    $props();

  let comparing = $derived(presentation.isComparing(cityName));
  let compareFull = $derived(!comparing && presentation.comparisonFull);
  let compareButton: HTMLButtonElement;
  let comparedEntry = $derived(
    presentation.comparisonEntries.find(
      (entry) => cityIdentity(entry.city.name) === cityIdentity(cityName)
    )
  );
  let salaryDiffers = $derived(
    comparedEntry != null &&
      presentation.salary != null &&
      comparedEntry.salary !== presentation.salary
  );

  async function onCompare() {
    if (presentation.isComparing(cityName)) {
      presentation.removeComparison(cityName);
      return;
    }
    await presentation.addComparison(cityName);
  }

  async function updateComparedSalary() {
    if (
      presentation.salary == null ||
      !presentation.setComparisonSalary(cityName, presentation.salary)
    )
      return;
    await tick();
    compareButton.focus({ preventScroll: true });
  }
</script>

<!-- Secondary actions share the input deck's footer. -->
<div class="flex flex-wrap items-start gap-2 md:gap-x-4">
  <button
    bind:this={compareButton}
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
    aria-label="Explore other cities"
    class="min-h-11 cursor-pointer rounded-md px-1 py-2 text-sm font-semibold text-accent"
    >Explore cities</button
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
{#if comparedEntry}
  <div class="mt-2 border-t border-line pt-3 text-sm" data-testid="saved-comparison">
    <p role="status" class="text-muted">Saved in Compare at {money(comparedEntry.salary)}/yr.</p>
    {#if salaryDiffers}
      {#if comparedEntry.actualTakeHomeMonthly != null}
        <p class="mt-1 text-meta text-muted">
          Updating the salary clears this comparison’s entered take-home pay.
        </p>
      {/if}
      <button
        type="button"
        class="mt-1 min-h-11 cursor-pointer text-left font-semibold text-accent"
        onclick={updateComparedSalary}>Use {money(presentation.salary)} in Compare</button
      >
    {/if}
  </div>
{/if}
