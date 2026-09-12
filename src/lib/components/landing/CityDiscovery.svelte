<script lang="ts">
  import { findSeedCity, RENT_DATA_META } from '$lib/data/cities';
  import { findCityImage } from '$lib/data/city-images';
  import type { CitySuggestion } from '$lib/types';
  import { money } from '$lib/format';

  let {
    hrefForCity,
    onchoose
  }: { hrefForCity: (name: string) => string; onchoose: (city: CitySuggestion) => void } = $props();
  const cities = [
    'Chicago, IL',
    'Seattle, WA',
    'Atlanta, GA',
    'Denver, CO',
    'Charlotte, NC',
    'Philadelphia, PA'
  ].flatMap((name) => {
    const city = findSeedCity(name);
    return city ? [{ city, image: findCityImage(city.city, city.state) }] : [];
  });
</script>

<section class="discovery" aria-labelledby="discovery-heading">
  <div class="discovery-heading">
    <h2 id="discovery-heading" class="text-headline">Where could you land?</h2>
    <p class="text-sm text-muted">Explore a city, then make the numbers yours.</p>
  </div>
  <div class="city-gallery">
    {#each cities as { city, image } (city.name)}
      <article class="destination">
        <a
          href={hrefForCity(city.name)}
          onclick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            onchoose({
              label: city.name,
              city: city.city,
              state: city.state,
              lat: city.lat,
              lng: city.lng
            });
          }}
          class="destination-link"
          aria-label={`Explore ${city.name}`}
        >
          <div class="destination-photo">
            {#if image}
              <img
                src={image.url}
                alt={image.alt}
                loading="lazy"
                onerror={(event) => {
                  if (event.currentTarget instanceof HTMLImageElement)
                    event.currentTarget.style.visibility = 'hidden';
                }}
              />
            {/if}
            <span class="destination-name">{city.city}<small>{city.state}</small></span>
          </div>
          <div class="destination-rent">
            <span>1-bedroom estimate</span>
            <strong>{city.r1 == null ? 'Unavailable' : `${money(city.r1)}/mo`}</strong>
          </div>
        </a>
        {#if image}
          <p class="photo-credit">
            Photo: <a href={image.photographerUrl} target="_blank" rel="noopener"
              >{image.photographerName}</a
            >
            / <a href={image.sourceUrl} target="_blank" rel="noopener">Unsplash</a>
          </p>
        {/if}
      </article>
    {/each}
  </div>
  <p class="mt-5 text-meta text-muted">
    Apartment List estimates · {RENT_DATA_META.label}. Citywide figures, not individual listings.
  </p>
</section>

<style>
  .discovery {
    margin-top: 3.5rem;
  }
  .discovery-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .city-gallery {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.75rem;
  }
  .destination {
    min-width: 0;
  }
  .destination-link {
    display: block;
    color: var(--ink);
    text-decoration: none;
    border-radius: 1rem;
  }
  .destination-photo {
    position: relative;
    overflow: hidden;
    border-radius: 1rem;
    background: #18304b;
    aspect-ratio: 1.5;
  }
  .destination-photo::after {
    content: '';
    position: absolute;
    inset: 30% 0 0;
    background: linear-gradient(transparent, rgb(8 24 44 / 85%));
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 220ms;
  }
  .destination-link:hover img {
    transform: scale(1.035);
  }
  .destination-name {
    position: absolute;
    z-index: 1;
    bottom: 1.2rem;
    left: 1.2rem;
    color: white;
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 650;
  }
  small {
    display: block;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 400;
  }
  .destination-rent {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.9rem 0 0.35rem;
    font-size: 0.875rem;
  }
  .destination-rent span {
    color: var(--muted);
  }
  .photo-credit {
    font-size: 0.7rem;
    color: var(--muted);
  }
  .photo-credit a {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  @media (max-width: 800px) {
    .city-gallery {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem 1rem;
    }
  }
  @media (max-width: 440px) {
    .city-gallery {
      grid-template-columns: 1fr;
    }
  }
</style>
