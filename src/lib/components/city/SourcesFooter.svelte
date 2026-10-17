<script lang="ts">
  import { ACS_DATA_META, RENT_DATA_META } from '$lib/data/cities';
  import fmrMeta from '$lib/data/fmr-meta.json';

  let { class: className = '' }: { class?: string } = $props();
</script>

<footer id="sources" class="text-sm/relaxed text-muted {className}">
  <h2 class="mb-3 text-title text-ink">Data &amp; methods</h2>
  <p class="max-w-[90ch]">
    Rent estimates:
    <a
      href={RENT_DATA_META.dataUrl}
      target="_blank"
      rel="noopener"
      class="text-accent underline hover:text-accent-deep">Apartment List Rent Estimates</a
    >
    ({RENT_DATA_META.label}), © Apartment List, Inc.. Off-list cities use
    <a
      href="https://www.huduser.gov/portal/datasets/fmr.html"
      target="_blank"
      rel="noopener"
      class="text-accent underline">{fmrMeta.year} HUD Fair Market Rents</a
    >, area-level 40th-percentile gross rents including standard utilities. Tax figures are 2026
    estimates for a single filer taking the standard deduction. City facts:
    <a
      href={ACS_DATA_META.dataUrl}
      target="_blank"
      rel="noopener"
      class="text-accent underline hover:text-accent-deep"
      >U.S. Census Bureau {ACS_DATA_META.label}</a
    >. Other city locations &amp; populations:
    <a
      href="https://simplemaps.com/data/us-cities"
      target="_blank"
      rel="noopener"
      class="text-accent underline hover:text-accent-deep">SimpleMaps US Cities</a
    > (CC BY 4.0). All numbers are estimates.
  </p>
  <div class="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-meta">
    <a
      href="https://github.com/llithium/renttool"
      target="_blank"
      rel="noopener"
      class="text-ink underline underline-offset-4">Source code on GitHub</a
    >
    <a href="/privacy" class="text-muted underline underline-offset-4">Privacy</a>
    <a href="/terms" class="text-muted underline underline-offset-4">Terms</a>
  </div>
</footer>
