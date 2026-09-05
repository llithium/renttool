<script lang="ts">
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { onDestroy } from 'svelte';

  let { presentation, cityName }: { presentation: RentPlanPresentation; cityName: string } =
    $props();

  let comparing = $derived(presentation.isComparing(cityName));
  let compareFull = $derived(!comparing && presentation.comparisonFull);

  let shareLabel = $state('Copy link');
  let shareTimer: ReturnType<typeof setTimeout> | undefined;

  function resetShareLabel() {
    shareLabel = 'Copy link';
    shareTimer = undefined;
  }

  function scheduleShareReset() {
    clearTimeout(shareTimer);
    shareTimer = setTimeout(resetShareLabel, 2600);
  }

  async function onCompare() {
    if (presentation.isComparing(cityName)) {
      presentation.removeComparison(cityName);
      return;
    }
    await presentation.addComparison(cityName);
  }

  async function onShare() {
    if (!navigator.clipboard?.writeText) {
      shareLabel = 'Copy unavailable';
      scheduleShareReset();
      return;
    }
    try {
      await navigator.clipboard.writeText(presentation.buildShareUrl(location.origin));
      shareLabel = 'Copied link';
    } catch {
      shareLabel = 'Copy unavailable';
    }
    scheduleShareReset();
  }

  onDestroy(() => clearTimeout(shareTimer));
</script>

<!-- Secondary actions live after the answer so they cannot compete with the plan. -->
<div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
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
    aria-live="polite"
    title="Copy a shareable link"
    onclick={onShare}
    class="min-h-11 cursor-pointer rounded-md px-1 py-2 text-sm font-medium text-muted transition-colors duration-200 not-disabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-55"
  >
    {shareLabel}
  </button>
  {#if presentation.comparisonNames.length}
    <a
      href="#comparison-section"
      class="min-h-11 rounded-md px-1 py-2 text-sm font-semibold text-accent no-underline hover:bg-accent-soft hover:text-accent-deep"
    >
      View comparison ({presentation.comparisonNames.length})
    </a>
  {/if}
</div>
