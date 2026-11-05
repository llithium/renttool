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

<header class="flex min-h-20 items-center justify-between gap-2 pb-4 {className}">
  <a
    href={planHref}
    class="flex shrink-0 items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-ink no-underline sm:text-2xl"
    ><svg width="36" height="36" viewBox="0 0 64 64" fill="none" aria-hidden="true"
      ><rect width="64" height="64" rx="18" fill="var(--primary)" />
      <path
        fill="var(--primary-ink)"
        fill-rule="evenodd"
        d="M17 50V26l15-11 15 11v9l-9 5 11 10H38L27 40h-2v10h-8Zm8-21v4h14v-4l-7-5-7 5Z"
      />
    </svg><span class="max-[359px]:sr-only">Rent Tool</span></a
  >
  <nav aria-label="Primary" class="flex items-center gap-1 rounded-full bg-card-2 p-1">
    <a
      href={planHref}
      aria-current={activeView === 'plan' ? 'page' : undefined}
      class="inline-flex w-16 items-center justify-center rounded-full px-3 py-2.5 text-label no-underline transition-colors duration-200 sm:w-24 sm:px-6 {activeView ===
      'plan'
        ? 'bg-primary text-primary-ink'
        : 'text-muted hover:text-ink'}"
    >
      Plan
    </a>
    <a
      href={compareHref}
      aria-current={activeView === 'compare' ? 'page' : undefined}
      class="flex w-24 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-label no-underline transition-colors duration-200 sm:w-32 sm:px-6 {activeView ===
      'compare'
        ? 'bg-primary text-primary-ink'
        : 'text-muted hover:text-ink'}"
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
