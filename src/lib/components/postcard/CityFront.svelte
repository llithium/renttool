<script lang="ts">
  import type { Snippet } from 'svelte';
  import { findCityImage } from '$lib/data/city-images';
  import { STATE_NAME } from '$lib/data/states';
  import { formatCoordinates, ridgePaths } from '$lib/postcard';
  import type { CityImage } from '$lib/types';

  /**
   * The picture side of a postcard. Cities with a checked-in photo show it with
   * credit; every other city gets a navy ridgeline drawn from its name, with its
   * coordinates, so no card is ever blank.
   */
  let {
    place,
    variant = 'hero',
    heading = 'h1',
    detail,
    badge,
    action
  }: {
    place: { name: string; city: string; state: string; lat?: number; lng?: number };
    variant?: 'hero' | 'mini' | 'feature';
    heading?: 'h1' | 'h2' | 'h3';
    detail?: string;
    badge?: Snippet;
    action?: Snippet;
  } = $props();

  let image = $derived<CityImage | null>(findCityImage(place.city, place.state));
  let failed = $state<string | null>(null);
  let showPhoto = $derived(image != null && failed !== image.url);

  // An image that failed before hydration never fires onerror for us, so check
  // its state once it is in the page.
  function detectBroken(node: HTMLImageElement) {
    if (node.complete && node.naturalWidth === 0) failed = node.getAttribute('src');
  }
  let stateName = $derived(STATE_NAME[place.state] ?? place.state);
  let coordinates = $derived(formatCoordinates(place.lat, place.lng));
  let ridges = $derived(ridgePaths(place.name, 560, 640));
  let nameSize = $derived(
    variant === 'mini'
      ? place.city.length > 16
        ? 'long'
        : 'short'
      : place.city.length > 22
        ? 'xlong'
        : place.city.length > 13
          ? 'long'
          : 'short'
  );
</script>

<div class="pc-front" data-variant={variant} data-photo={showPhoto ? 'true' : 'false'}>
  {#if showPhoto && image}
    <img
      src={image.url}
      alt={image.alt}
      loading={variant === 'hero' ? 'eager' : 'lazy'}
      decoding="async"
      style:object-position={image.focusY == null ? undefined : `50% ${image.focusY}%`}
      onerror={() => (failed = image?.url ?? null)}
      use:detectBroken
    />
  {:else}
    <svg
      class="pc-ridges"
      viewBox="0 0 560 640"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      data-testid="city-fallback-art"
    >
      <rect width="560" height="640" fill="var(--navy)" />
      <path d={ridges[0]} fill="var(--navy-2)" />
      <path d={ridges[1]} fill="var(--navy-3)" />
    </svg>
    {#if coordinates}<p class="pc-coords">{coordinates}</p>{/if}
  {/if}
  {#if badge}<div class="pc-badge">{@render badge()}</div>{/if}

  <div class="pc-band" data-size={nameSize}>
    <svelte:element this={heading} class="pc-name">{place.city}</svelte:element>
    <p class="pc-sub">
      <span>{detail ?? stateName}</span>
      {#if action}{@render action()}{/if}
      {#if showPhoto && image}
        <span class="pc-credit">
          Photo: <a href={image.photographerUrl} target="_blank" rel="noopener"
            >{image.photographerName.length > 40
              ? image.photographerName.slice(0, 38) + '…'
              : image.photographerName}</a
          >,
          {#if image.source === 'unsplash'}
            <a href={image.sourceUrl} target="_blank" rel="noopener">Unsplash</a>
          {:else}
            <a href={image.photoUrl} target="_blank" rel="noopener">Wikimedia Commons</a>,
            <a href={image.licenseUrl} target="_blank" rel="noopener">{image.licenseName}</a>
          {/if}
        </span>
      {/if}
    </p>
  </div>
</div>

<style>
  .pc-front {
    position: relative;
    overflow: hidden;
    height: 100%;
    background: var(--navy);
    color: #fff;
  }
  .pc-front[data-variant='hero'] {
    min-height: 40rem;
  }
  .pc-front[data-variant='feature'] {
    min-height: 37.5rem;
  }
  .pc-front[data-variant='mini'] {
    height: 11.5rem;
  }
  img,
  .pc-ridges {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .pc-coords {
    position: absolute;
    top: 2rem;
    left: 1.75rem;
    margin: 0;
    color: #afc0d6;
    font-size: 0.9375rem;
  }
  [data-variant='feature'] .pc-coords {
    right: 1.75rem;
    left: auto;
  }
  [data-variant='mini'] .pc-coords {
    top: 0.875rem;
    right: 1rem;
    left: auto;
    font-size: 0.75rem;
  }
  .pc-badge {
    position: absolute;
    top: 1.25rem;
    left: 1.25rem;
    z-index: 1;
  }
  [data-variant='mini'] .pc-badge {
    top: 0.75rem;
    left: 0.75rem;
  }
  .pc-band {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 1.75rem 1.75rem 1.5rem;
    background: var(--navy);
  }
  [data-variant='mini'] .pc-band {
    padding: 0.75rem 1rem 0.625rem;
  }
  /* With no photo, the hero name stands tall over the ridgeline. */
  [data-variant='hero'][data-photo='false'] .pc-band {
    top: 4rem;
    bottom: auto;
    background: transparent;
  }
  .pc-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 5.25rem;
    font-weight: 800;
    line-height: 0.88;
    letter-spacing: -0.02em;
    font-variation-settings: 'wdth' 78;
    overflow-wrap: anywhere;
  }
  [data-variant='hero'][data-photo='false'] .pc-name {
    font-size: 6.5rem;
  }
  [data-variant='hero'] [data-size='long'] .pc-name,
  [data-variant='hero'][data-photo='false'] [data-size='long'] .pc-name {
    font-size: 4.25rem;
  }
  [data-variant='hero'] [data-size='xlong'] .pc-name,
  [data-variant='hero'][data-photo='false'] [data-size='xlong'] .pc-name {
    font-size: 3.25rem;
  }
  [data-variant='feature'] .pc-name {
    font-size: 4rem;
  }
  [data-variant='feature'] [data-size='long'] .pc-name,
  [data-variant='feature'] [data-size='xlong'] .pc-name {
    font-size: 3rem;
  }
  [data-variant='mini'] .pc-name {
    font-size: 1.875rem;
    line-height: 0.95;
    letter-spacing: -0.01em;
  }
  [data-variant='mini'] [data-size='long'] .pc-name {
    font-size: 1.5rem;
  }
  .pc-sub {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.25rem 0.75rem;
    margin: 0.75rem 0 0;
    color: var(--mist);
    font-size: 0.9375rem;
  }
  [data-variant='mini'] .pc-sub {
    margin-top: 0.25rem;
    font-size: 0.75rem;
  }
  .pc-credit {
    color: #b9c6d6;
    font-size: 0.8125rem;
  }
  [data-variant='mini'] .pc-credit {
    font-size: 0.6875rem;
  }
  .pc-credit a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .pc-credit a:hover {
    color: #fff;
  }
  .pc-front :global(a:focus-visible) {
    outline-color: var(--pink);
  }

  @media (max-width: 1060px) {
    .pc-front[data-variant='hero'],
    .pc-front[data-variant='feature'] {
      min-height: 26rem;
    }
    [data-variant='hero'][data-photo='false'] .pc-band {
      top: 3.5rem;
    }
  }
  @media (max-width: 600px) {
    .pc-front[data-variant='hero'],
    .pc-front[data-variant='feature'] {
      min-height: 22rem;
    }
    .pc-band {
      padding: 1.25rem 1rem 1rem;
    }
    .pc-name,
    [data-variant='hero'][data-photo='false'] .pc-name,
    [data-variant='feature'] .pc-name {
      font-size: 3.5rem;
    }
    [data-variant='hero'] [data-size='long'] .pc-name,
    [data-variant='hero'][data-photo='false'] [data-size='long'] .pc-name,
    [data-variant='feature'] [data-size='long'] .pc-name {
      font-size: 2.75rem;
    }
    [data-variant='hero'] [data-size='xlong'] .pc-name,
    [data-variant='hero'][data-photo='false'] [data-size='xlong'] .pc-name,
    [data-variant='feature'] [data-size='xlong'] .pc-name {
      font-size: 2.25rem;
    }
    .pc-coords {
      left: 1rem;
      top: 1.25rem;
    }
  }
</style>
