<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ACS_DATA_META, RENT_DATA_META } from '$lib/data/cities';
  import fmrMeta from '$lib/data/fmr-meta.json';

  let { children }: { children?: Snippet } = $props();
</script>

<footer class="pc-foot" id="sources">
  <p>
    Rents: <a href={RENT_DATA_META.dataUrl} target="_blank" rel="noopener"
      >Apartment List Rent Estimates</a
    >, {RENT_DATA_META.label}, citywide estimates. Cities without them use
    <a href="https://www.huduser.gov/portal/datasets/fmr.html" target="_blank" rel="noopener"
      >{fmrMeta.year} HUD Fair Market Rents</a
    >. Facts:
    <a href={ACS_DATA_META.dataUrl} target="_blank" rel="noopener"
      >U.S. Census Bureau {ACS_DATA_META.label}</a
    >. Places and populations:
    <a href="https://simplemaps.com/data/us-cities" target="_blank" rel="noopener">SimpleMaps</a>
    (CC BY 4.0). City summaries from Wikipedia. Taxes are 2026 estimates for a single filer with the standard
    deduction and aren't tax advice.
    {@render children?.()}
  </p>
  <p class="pc-foot-links">
    <a href="https://github.com/llithium/renttool" target="_blank" rel="noopener">Source code</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </p>
</footer>

<style>
  .pc-foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem 2rem;
    margin-top: 4.5rem;
    padding: 1.5rem 0 3.5rem;
    border-top: 1px solid #c5cdd5;
    color: var(--muted);
    font-size: 0.8125rem;
    line-height: 1.6;
  }
  .pc-foot p {
    max-width: 80ch;
    margin: 0;
  }
  .pc-foot a {
    color: var(--navy);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .pc-foot-links {
    display: flex;
    gap: 1rem;
  }
</style>
