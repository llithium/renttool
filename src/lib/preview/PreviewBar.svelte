<script lang="ts">
  import { page } from '$app/state';
  import { VARIANTS } from './variants';
  import type { PreviewState } from './state.svelte';

  let { state, current }: { state: PreviewState; current: string } = $props();

  function href(slug: string) {
    const q = page.url.searchParams.toString();
    return `/preview/${slug}${q ? `?${q}` : ''}`;
  }
</script>

<nav class="pbar" aria-label="Design previews">
  <a class="home" href="/preview">Previews</a>
  {#each VARIANTS as v, i (v.slug)}
    <a href={href(v.slug)} aria-current={v.slug === current ? 'page' : undefined}
      >{i + 1}. {v.name}</a
    >
  {/each}
  <label>
    <input
      type="checkbox"
      checked={!state.photo}
      onchange={(e) => state.set({ photo: !e.currentTarget.checked })}
    />
    Hide photo
  </label>
</nav>

<style>
  .pbar {
    position: fixed;
    z-index: 2000;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    display: flex;
    gap: 2px;
    align-items: center;
    max-width: calc(100vw - 24px);
    overflow-x: auto;
    padding: 4px;
    border-radius: 999px;
    background: rgb(20 20 24 / 0.86);
    backdrop-filter: blur(8px);
    color: #eee;
    font:
      500 12px/1 system-ui,
      sans-serif;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
  }
  a,
  label {
    white-space: nowrap;
    padding: 7px 10px;
    border-radius: 999px;
    color: inherit;
    text-decoration: none;
  }
  a:hover {
    background: rgb(255 255 255 / 0.12);
  }
  a[aria-current='page'] {
    background: #fff;
    color: #111;
  }
  .home {
    opacity: 0.6;
  }
  label {
    display: flex;
    gap: 6px;
    align-items: center;
    border-left: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 0;
    margin-left: 4px;
    cursor: pointer;
  }
  @media print {
    .pbar {
      display: none;
    }
  }
</style>
