<script lang="ts">
  import Select from './Select.svelte';
  import { onDestroy } from 'svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  let { presentation, pathname = '/' }: { presentation: RentPlanPresentation; pathname?: string } =
    $props();
  let scope = $state<'cities' | 'full'>('cities');
  let label = $state('Copy link');
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        presentation.buildShareUrl(location.origin, scope, pathname)
      );
      label = scope === 'cities' ? 'Copied cities link' : 'Copied full plan';
    } catch {
      label = 'Copy unavailable';
    }
    clearTimeout(timer);
    timer = setTimeout(() => (label = 'Copy link'), 2600);
  }
  onDestroy(() => clearTimeout(timer));
</script>

<details class="min-w-0">
  <summary class="min-h-11 cursor-pointer py-3 text-sm font-semibold text-accent"
    >Share plan</summary
  >
  <div class="max-w-sm rounded-lg border border-line-strong bg-card p-4">
    <Select
      id={`share-${pathname === '/' ? 'plan' : 'compare'}`}
      label="Include in link"
      value={scope}
      options={[
        { value: 'cities', label: 'Share cities only' },
        { value: 'full', label: 'Share full plan' }
      ] as const}
      onchange={(value) => (scope = value)}
    />
    <p class="mt-2 text-meta text-muted">
      {scope === 'cities'
        ? 'City choices and housing setup. Your financial details are excluded.'
        : 'Includes salaries, take-home pay, expenses, savings, buffer, and comparison overrides.'}
    </p>
    <button
      type="button"
      onclick={copy}
      class="mt-3 min-h-11 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
      >Copy link</button
    >
    <p class="mt-2 text-meta text-muted" role="status">{label === 'Copy link' ? '' : label}</p>
  </div>
</details>
