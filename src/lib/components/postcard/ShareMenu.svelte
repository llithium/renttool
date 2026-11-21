<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';

  let {
    presentation,
    pathname = '/',
    label = 'Share plan'
  }: { presentation: RentPlanPresentation; pathname?: string; label?: string } = $props();

  let scope = $state<'cities' | 'full'>('cities');
  let message = $state('');
  let open = $state(false);
  let root: HTMLDetailsElement;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        presentation.buildShareUrl(location.origin, scope, pathname)
      );
      message =
        scope === 'cities' ? 'Copied a link with just the cities.' : 'Copied the full plan.';
    } catch {
      message = "Couldn't copy. Your browser blocked the clipboard.";
    }
    clearTimeout(timer);
    timer = setTimeout(() => (message = ''), 3000);
  }

  function closeOnOutside(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }
  onDestroy(() => clearTimeout(timer));
</script>

<svelte:window
  onpointerdown={closeOnOutside}
  onkeydown={(event) => {
    if (open && event.key === 'Escape') {
      open = false;
      root.querySelector('summary')?.focus();
    }
  }}
/>

<details class="pc-share" bind:open bind:this={root}>
  <summary class="pc-btn">{label}</summary>
  <div class="pc-share-pop">
    <div class="pc-seg" role="group" aria-label="Include in link">
      <button type="button" aria-pressed={scope === 'cities'} onclick={() => (scope = 'cities')}
        >Cities only</button
      >
      <button type="button" aria-pressed={scope === 'full'} onclick={() => (scope = 'full')}
        >Full plan</button
      >
    </div>
    <p>
      {scope === 'cities'
        ? 'City choices and housing. Your salary and costs stay out of the link.'
        : 'Includes salaries, take-home, costs, and per-city changes.'}
    </p>
    <button type="button" class="pc-btn pc-btn-dark" onclick={copy}>Copy link</button>
    <p role="status" class="pc-share-msg">{message}</p>
  </div>
</details>

<style>
  .pc-share {
    position: relative;
  }
  summary {
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .pc-share-pop {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 40;
    display: grid;
    width: min(20rem, calc(100vw - 2rem));
    gap: 0.75rem;
    padding: 1rem;
    border: 1.5px solid var(--navy);
    border-radius: 8px;
    background: #fff;
    box-shadow: var(--elevation-pop);
  }
  .pc-share-pop p {
    margin: 0;
    color: var(--muted);
    font-size: 0.8125rem;
    line-height: 1.45;
  }
  .pc-share-pop .pc-share-msg:empty {
    display: none;
  }
  @media (max-width: 600px) {
    .pc-share-pop {
      right: auto;
      left: 0;
    }
  }
</style>
