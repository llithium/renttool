<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    homeHref = '/',
    children,
    end
  }: { homeHref?: string; children?: Snippet; end?: Snippet } = $props();
</script>

<header class="pc-top">
  <a class="pc-brand pc-display" href={homeHref} aria-label="Renttool home">
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--pink)" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="var(--navy)" stroke-width="3" />
      <path d="M16 6a10 10 0 0 1 9.5 13" fill="none" stroke="var(--navy)" stroke-width="5" />
    </svg>
    <span>Renttool</span>
  </a>
  {@render children?.()}
  <span class="pc-top-gap"></span>
  {@render end?.()}
</header>

<style>
  .pc-top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 0.625rem;
    padding: 1.25rem 0;
  }
  .pc-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 0.375rem;
    color: var(--navy);
    font-size: 1.375rem;
    font-weight: 800;
    text-decoration: none;
  }
  .pc-top-gap {
    flex: 1;
  }
  @media (max-width: 760px) {
    .pc-top-gap {
      display: none;
    }
  }
</style>
