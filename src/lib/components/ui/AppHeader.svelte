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

<header
  class="flex min-h-16 items-center justify-between gap-3 border-b border-line py-3 {className}"
>
  <a
    href={planHref}
    class="flex shrink-0 items-center gap-2 text-base text-ink no-underline sm:text-title"
    ><svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true"
      ><rect width="32" height="32" rx="7" fill="var(--primary)" /><path
        d="M9 22V13l7-5 7 5v9h-5v-6h-4v6H9Z"
        stroke="var(--primary-ink)"
        stroke-width="1.7"
        stroke-linejoin="round"
      /></svg
    ><span class="max-[389px]:sr-only">Rent Tool</span></a
  >
  <nav
    aria-label="Primary"
    class="flex items-center gap-1 rounded-full border border-line bg-card-2 p-1"
  >
    <a
      href={planHref}
      aria-current={activeView === 'plan' ? 'page' : undefined}
      class="rounded-full p-2 text-label no-underline transition-colors duration-200 active:scale-98 sm:px-4 {activeView ===
      'plan'
        ? 'bg-primary text-primary-ink'
        : 'text-ink hover:bg-card-2'}"
    >
      Plan
    </a>
    <a
      href={compareHref}
      aria-current={activeView === 'compare' ? 'page' : undefined}
      class="flex w-24 items-center justify-center gap-1.5 rounded-full p-2 text-label no-underline transition-colors duration-200 active:scale-98 sm:w-28 sm:px-4 {activeView ===
      'compare'
        ? 'bg-primary text-primary-ink'
        : 'text-ink hover:bg-card-2'}"
    >
      Compare
      {#if comparisonCount}
        <span
          class="min-w-4 text-center text-[0.625rem]/4 font-semibold tabular-nums {activeView ===
          'compare'
            ? 'text-primary-ink'
            : 'text-muted'}">{comparisonCount}</span
        >
      {/if}
    </a>
  </nav>
  <ThemeToggle />
</header>
