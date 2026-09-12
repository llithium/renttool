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

<header class="flex items-center justify-between gap-2 border-b border-line py-4 {className}">
  <a
    href={planHref}
    class="flex shrink-0 items-center gap-2 text-base text-ink no-underline sm:text-title"
    ><svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true"
      ><rect width="32" height="32" rx="10" fill="var(--accent)" /><path
        d="M9 22V13l7-5 7 5v9h-5v-6h-4v6H9Z"
        stroke="var(--accent-ink)"
        stroke-width="1.7"
        stroke-linejoin="round"
      /></svg
    >Rent Tool</a
  >
  <nav aria-label="Primary" class="flex items-center gap-1">
    <a
      href={planHref}
      aria-current={activeView === 'plan' ? 'page' : undefined}
      class="rounded-full p-2 text-label no-underline transition-colors duration-200 active:scale-98 sm:px-4 {activeView ===
      'plan'
        ? 'bg-accent-soft text-accent hover:bg-accent-soft'
        : 'text-ink hover:bg-card-2'}"
    >
      Plan
    </a>
    <a
      href={compareHref}
      aria-current={activeView === 'compare' ? 'page' : undefined}
      class="flex items-center gap-1.5 rounded-full p-2 text-label no-underline transition-colors duration-200 active:scale-98 sm:px-4 {activeView ===
      'compare'
        ? 'bg-accent-soft text-accent hover:bg-accent-soft'
        : 'text-ink hover:bg-card-2'}"
    >
      Compare
      {#if comparisonCount}
        <span
          class="min-w-4 text-center text-[0.625rem]/4 font-semibold tabular-nums {activeView ===
          'compare'
            ? 'text-accent'
            : 'text-muted'}">{comparisonCount}</span
        >
      {/if}
    </a>
    <ThemeToggle />
  </nav>
</header>
