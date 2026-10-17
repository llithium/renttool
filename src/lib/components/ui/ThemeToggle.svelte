<script lang="ts">
  import { onMount } from 'svelte';

  let theme = $state<'light' | 'dark'>('light');

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  });

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rent-tool-theme', theme);
    } catch {
      // The theme still works for this session when storage is unavailable.
    }
  }
</script>

<button
  type="button"
  onclick={toggleTheme}
  aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
  class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-meta text-muted transition-colors duration-200 hover:border-line-strong hover:text-ink active:scale-98"
>
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none">
    {#if theme === 'light'}<path
        d="M16.8 12A7 7 0 0 1 8 3.2 7 7 0 1 0 16.8 12Z"
        stroke="currentColor"
        stroke-width="1.5"
      />{:else}<circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.5" /><path
        d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6 5 5m10 10 1.4 1.4M3.6 16.4 5 15M15 5l1.4-1.4"
        stroke="currentColor"
        stroke-width="1.5"
      />{/if}
  </svg>
  {theme === 'light' ? 'Dark' : 'Light'}
</button>
