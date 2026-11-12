<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { RENT_DATA_META, SEED_CITIES } from '$lib/data/cities';
  import { findCityImage } from '$lib/data/city-images';
  import ImageCredit from '$lib/components/city/ImageCredit.svelte';
  import { STATE_NAME } from '$lib/data/states';
  import { housingRent, housingShortLabel } from '$lib/planning';
  import { money } from '$lib/format';

  let { children, presentation }: { children?: Snippet; presentation: RentPlanPresentation } =
    $props();

  let city = $derived(presentation.activeCity);
  const heroCities = new Set([
    'Chicago, IL',
    'Seattle, WA',
    'Denver, CO',
    'Atlanta, GA',
    'Philadelphia, PA',
    'Tampa, FL'
  ]);
  const featuredCities = SEED_CITIES.filter((city) => heroCities.has(city.name)).flatMap((city) => {
    const image = findCityImage(city.city, city.state);
    return image ? [{ city, image }] : [];
  });
  // Pick once per visit so the destination stays still while someone reads or navigates.
  const featured = featuredCities[Math.floor(Math.random() * featuredCities.length)];
  const featuredCity = featured?.city;
  const featuredImage = featured?.image;
  let featuredRent = $derived(
    featuredCity ? housingRent(featuredCity, presentation.options.housing) : null
  );
  let featuredHref = $derived.by(() => {
    const params = new URLSearchParams(presentation.buildHref('/').split('?')[1]);
    if (featuredCity) params.set('city', featuredCity.name);
    return `/?${params}`;
  });
</script>

<article aria-label="Rent plan" class="min-w-0" class:landing={!city}>
  {#if !city}
    <header class="arrival-heading">
      <h1>Find your city.<br />Know your rent.</h1>
      <p>
        Choose a city and enter your salary to see local rents and what you’ll have left each month.
      </p>
    </header>
  {/if}

  <!-- Render the controls once so selecting a city preserves input focus. -->
  <div class="landing-editor">
    {@render children?.()}
  </div>

  {#if !city && featuredCity && featuredImage}
    <figure class="featured-city" aria-label="Featured city">
      <div class="featured-photo">
        <img
          src={featuredImage.url}
          style:object-position={featuredImage.focusY == null
            ? undefined
            : `50% ${featuredImage.focusY}%`}
          alt={featuredImage.alt}
          fetchpriority="high"
          onerror={(event) => {
            if (event.currentTarget instanceof HTMLImageElement)
              event.currentTarget.style.visibility = 'hidden';
          }}
        />
        <div class="featured-meta">
          <div class="featured-location">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"
                stroke="currentColor"
                stroke-width="1.7"
              />
              <circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.7" />
            </svg>
            {featuredCity.city}, {STATE_NAME[featuredCity.state] ?? featuredCity.state}
          </div>
          <p class="featured-credit">
            <ImageCredit image={featuredImage} />
          </p>
        </div>
      </div>
      <figcaption class="featured-caption">
        <div class="featured-rent">
          <span>{housingShortLabel(presentation.options.housing)} estimate</span>
          <strong
            >{featuredRent == null ? 'Unavailable' : money(featuredRent)}<small>
              / month</small
            ></strong
          >
        </div>
        <a
          href={featuredHref}
          class="featured-explore"
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
            void presentation.chooseCity({
              label: featuredCity.name,
              city: featuredCity.city,
              state: featuredCity.state,
              lat: featuredCity.lat,
              lng: featuredCity.lng
            });
          }}
        >
          Explore {featuredCity.city}
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12h14m-6-6 6 6-6 6"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </a>
        <p>Apartment List · {RENT_DATA_META.label} · citywide estimate</p>
      </figcaption>
    </figure>
  {/if}
</article>

<style>
  .landing {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    grid-template-areas: 'heading photo' 'editor photo';
    grid-template-rows: auto 1fr;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 1.5rem;
    background: var(--card);
    box-shadow: var(--elevation-card);
  }
  .arrival-heading {
    grid-area: heading;
    padding: 2.5rem 2.5rem 1.75rem;
  }
  .arrival-heading h1 {
    font-size: clamp(2.75rem, 4.6vw, 4.25rem);
    font-weight: 600;
    line-height: 1.04;
    letter-spacing: -0.035em;
  }
  .arrival-heading p {
    max-width: 42ch;
    margin-top: 1.25rem;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--muted);
  }
  .landing .landing-editor {
    grid-area: editor;
    padding: 0 2.5rem 1.5rem;
  }
  .landing .landing-editor :global(#plan-controls) {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  .featured-city {
    position: relative;
    grid-area: photo;
    min-width: 0;
    min-height: 35rem;
    display: flex;
    flex-direction: column;
  }
  .featured-photo {
    position: relative;
    flex: 1;
    min-height: 20rem;
    overflow: hidden;
    background: #294773;
  }
  .featured-photo::after {
    content: '';
    position: absolute;
    inset: 35% 0 0;
    background: linear-gradient(transparent, rgb(7 20 47 / 88%));
    pointer-events: none;
  }
  .featured-photo img {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .featured-meta {
    position: absolute;
    z-index: 1;
    right: 1.5rem;
    bottom: 1.25rem;
    left: 1.5rem;
  }
  .featured-location {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: white;
    font-size: 1.125rem;
    font-weight: 600;
  }
  .featured-location svg {
    flex-shrink: 0;
  }
  .featured-credit {
    margin-top: 0.375rem;
    color: white;
    font-size: 0.75rem;
    line-height: 1.4;
  }
  .featured-caption {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1.25rem;
    border-radius: 0;
    background: var(--card);
  }
  .featured-rent span {
    display: block;
    margin-bottom: 0.25rem;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .featured-rent strong {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }
  .featured-rent small {
    color: var(--muted);
    font-size: 0.8125rem;
    font-weight: 400;
    letter-spacing: 0;
  }
  .featured-explore {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.625rem;
    padding: 0.625rem 0.875rem;
    background: var(--primary);
    color: var(--primary-ink);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
  }
  .featured-explore:hover {
    filter: brightness(0.95);
  }
  .featured-caption > p {
    flex-basis: 100%;
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.4;
  }
  @media (max-width: 1000px) {
    .landing {
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    }
    .arrival-heading {
      padding: 2rem 1.5rem 1.5rem;
    }
    .landing .landing-editor {
      padding: 0 1.5rem 1.5rem;
    }
  }
  @media (max-width: 700px) {
    .landing {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'heading' 'editor' 'photo';
      border-radius: 1.25rem;
    }
    .arrival-heading {
      padding: 1.5rem 1.25rem;
    }
    .arrival-heading h1 {
      font-size: clamp(2rem, 8.7vw, 3.5rem);
    }
    .arrival-heading p {
      margin-top: 1rem;
    }
    .landing .landing-editor {
      padding: 0 1.25rem 1.25rem;
    }
    .featured-city {
      min-height: 22rem;
    }
    .featured-photo {
      min-height: 16rem;
    }
    .featured-meta {
      left: 1.25rem;
      bottom: 1.25rem;
    }
    .featured-location {
      font-size: 1rem;
    }
    .featured-caption {
      padding: 1rem;
      gap: 0.625rem;
    }
    .featured-rent strong {
      font-size: 1.75rem;
    }
  }
</style>
