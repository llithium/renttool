<script lang="ts">
  import { findCityImage } from '$lib/data/city-images';
  import type { City } from '$lib/types';
  import ImageCredit from './ImageCredit.svelte';

  let { city, class: className = '' }: { city: City; class?: string } = $props();
  let image = $derived(findCityImage(city.city, city.state));
  let hidden = $state(false);
</script>

{#if image && !hidden}
  <figure data-testid="city-image" class="overflow-hidden {className}">
    <a
      href={image.photoUrl}
      target="_blank"
      rel="noopener"
      class="group relative block overflow-hidden"
      aria-label={`View photo of ${city.name}`}
    >
      <img
        src={image.url}
        style:object-position={image.focusY == null ? undefined : `50% ${image.focusY}%`}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        class="aspect-video max-h-48 w-full object-cover"
        onerror={() => (hidden = true)}
      />
      <span
        class="absolute right-3 bottom-3 rounded-sm bg-ink/85 px-2 py-1 text-meta text-canvas opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        View photo ↗
      </span>
    </a>
    <figcaption class="py-2 text-meta text-muted">
      <ImageCredit {image} />
    </figcaption>
  </figure>
{/if}
