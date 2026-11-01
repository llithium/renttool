<script lang="ts">
  import type { CityImage } from '$lib/types';

  let { image }: { image: CityImage } = $props();
</script>

Photo: <a href={image.photographerUrl} target="_blank" rel="noopener">{image.photographerName}</a>
/
<a href={image.sourceUrl} target="_blank" rel="noopener"
  >{image.source === 'unsplash' ? 'Unsplash' : 'Wikimedia Commons'}</a
>
{#if image.source === 'wikimedia'}
  / <a href={image.licenseUrl} target="_blank" rel="noopener">{image.licenseName}</a>
  <span class="block">
    <a href={image.photoUrl} target="_blank" rel="noopener">{image.title}</a> · Cropped for display
  </span>
{/if}

<style>
  a {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
