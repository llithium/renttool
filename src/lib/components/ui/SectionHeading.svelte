<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The small uppercase label that opens each result section. The optional
   * `children` snippet fills the right-hand slot (a source credit, a legend, a
   * link) and is baseline-aligned with the title.
   */
  let {
    title,
    class: className = '',
    children
  }: {
    title: string;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="mb-6 flex flex-wrap items-baseline justify-between gap-4 {className}">
  <h2 class="text-title text-ink">{title}</h2>
  {@render children?.()}
</div>
