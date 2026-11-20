<script lang="ts">
  import { VARIANTS } from '$lib/preview/variants';
</script>

<svelte:head><title>Main page previews</title></svelte:head>

<main class="idx">
  <h1>Five directions for the main page</h1>
  <p>
    Each preview uses the real bundled data. Add <code>?city=Lynnwood, WA</code> to try a city without
    a photo, or use the bar at the bottom of any preview.
  </p>
  <ol>
    {#each VARIANTS as v (v.slug)}
      <li><a href="/preview/{v.slug}">{v.name}</a> <span>{v.idea}</span></li>
    {/each}
  </ol>
</main>

<style>
  .idx {
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
    font:
      16px/1.5 system-ui,
      sans-serif;
  }
  h1 {
    font-size: 1.6rem;
  }
  li {
    margin: 0.6rem 0;
  }
  a {
    font-weight: 600;
  }
  span {
    display: block;
    color: #666;
  }
</style>
