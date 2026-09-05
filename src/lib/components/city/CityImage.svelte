<script lang="ts">
  import { findCityImage } from '$lib/data/city-images';
  import type { City } from '$lib/types';

  let { city, class: className = '' }: { city: City; class?: string } = $props();
  let image = $derived(findCityImage(city.city, city.state));
  let hidden = $state(false);
</script>

{#if image && !hidden}
  <figure
    data-testid="city-image"
    class="overflow-hidden border border-line-strong bg-card-2 {className}"
  >
    <a
      href={image.photoUrl}
      target="_blank"
      rel="noopener"
      class="group relative block overflow-hidden"
      aria-label={`View photo of ${city.name}`}
    >
      <img
        src={image.url}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        class="aspect-3/1 max-h-64 w-full object-cover"
        onerror={() => (hidden = true)}
      />
      <span
        class="absolute right-3 bottom-3 rounded-sm bg-ink/85 px-2 py-1 text-meta text-canvas opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        View photo ↗
      </span>
    </a>
    <figcaption class="px-3 py-2 text-meta text-muted">
      Photo by
      <a
        href={image.photographerUrl}
        target="_blank"
        rel="noopener"
        class="text-accent underline decoration-1 underline-offset-2 hover:text-accent-deep"
        >{image.photographerName}</a
      >
      via
      <a
        href={image.sourceUrl}
        target="_blank"
        rel="noopener"
        class="text-accent underline decoration-1 underline-offset-2 hover:text-accent-deep"
        >Unsplash</a
      >
    </figcaption>
  </figure>
{/if}
