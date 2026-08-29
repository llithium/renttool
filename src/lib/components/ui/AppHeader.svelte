<script lang="ts">
  import ThemeToggle from './ThemeToggle.svelte';

  let {
    planHref,
    compareHref,
    activeView,
    comparisonCount = 0,
    class: className = ''
  }: {
    planHref: string;
    compareHref: string;
    activeView: 'plan' | 'compare';
    comparisonCount?: number;
    class?: string;
  } = $props();
</script>

<header class="flex items-center justify-end gap-4 border-b border-line-strong py-3 {className}">
  <nav aria-label="Primary" class="flex items-center gap-1">
    <a
      href={planHref}
      aria-current={activeView === 'plan' ? 'page' : undefined}
      class="rounded-full px-3 py-2 text-label no-underline transition-colors duration-200 active:scale-98 sm:px-4 {activeView ===
      'plan'
        ? 'bg-ink text-canvas hover:bg-ink'
        : 'text-ink hover:bg-card-2'}"
    >
      Plan
    </a>
    <a
      href={compareHref}
      aria-current={activeView === 'compare' ? 'page' : undefined}
      class="flex items-center gap-1.5 rounded-full px-3 py-2 text-label no-underline transition-colors duration-200 active:scale-98 sm:px-4 {activeView ===
      'compare'
        ? 'bg-ink text-canvas hover:bg-ink'
        : 'text-ink hover:bg-card-2'}"
    >
      Compare
      {#if comparisonCount}
        <span
          class="min-w-4 text-center text-[0.625rem]/4 font-semibold tabular-nums {activeView ===
          'compare'
            ? 'text-canvas/70'
            : 'text-muted'}">{comparisonCount}</span
        >
      {/if}
    </a>
    <ThemeToggle />
  </nav>
</header>
