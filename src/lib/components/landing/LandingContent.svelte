<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { RENT_DATA_META, SEED_CITIES } from '$lib/data/cities';
  import { findCityImage } from '$lib/data/city-images';
  import { STATE_NAME } from '$lib/data/states';
  import { housingRent, housingShortLabel } from '$lib/planning';
  import { money } from '$lib/format';
  import CityHeadline from '$lib/components/city/CityHeadline.svelte';

  let { children, presentation }: { children?: Snippet; presentation: RentPlanPresentation } =
    $props();

  let city = $derived(presentation.activeCity);
  const featuredCities = SEED_CITIES.flatMap((city) => {
    const image = findCityImage(city.city, city.state);
    return image ? [{ city, image }] : [];
  });
  const initialIndex = Math.floor(Math.random() * featuredCities.length);
  let featuredIndex = $state(initialIndex);
  let nextIndex = $state(pickNextCity(initialIndex));
  let reducedMotion = $state(false);
  let hovered = $state(false);
  let focused = $state(false);
  let visible = $state(true);
  let featuredCity = $derived(featuredCities[featuredIndex]?.city);
  let featuredImage = $derived(featuredCities[featuredIndex]?.image);
  let nextImage = $derived(featuredCities[nextIndex]?.image);
  let featuredRent = $derived(
    featuredCity ? housingRent(featuredCity, presentation.options.housing) : null
  );
  let featuredHref = $derived.by(() => {
    const params = new URLSearchParams(presentation.buildHref('/').split('?')[1]);
    if (featuredCity) params.set('city', featuredCity.name);
    return `/?${params}`;
  });

  function pickNextCity(current: number) {
    const offset = 1 + Math.floor(Math.random() * (featuredCities.length - 1));
    return (current + offset) % featuredCities.length;
  }

  onMount(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = preference.matches;
    visible = !document.hidden;
    const respectReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    preference.addEventListener('change', respectReducedMotion);
    return () => preference.removeEventListener('change', respectReducedMotion);
  });

  $effect(() => {
    // Leave the card still while someone reads, tabs through it, or edits a city plan.
    if (city) {
      hovered = false;
      focused = false;
      return;
    }
    if (reducedMotion || hovered || focused || !visible || featuredCities.length < 2) return;
    const timer = setInterval(() => {
      featuredIndex = nextIndex;
      nextIndex = pickNextCity(nextIndex);
    }, 8_000);
    return () => clearInterval(timer);
  });
</script>

<svelte:document onvisibilitychange={() => (visible = !document.hidden)} />

<svelte:head>
  {#if !city && !reducedMotion && nextImage}
    <!-- Load the next photo before fading out the current one. -->
    <link rel="preload" as="image" href={nextImage.url} fetchpriority="low" />
  {/if}
</svelte:head>

<article aria-label="Rent plan" class="min-w-0" class:landing={!city}>
  {#if city}
    <div class="city-arrival">
      <CityHeadline {city} />
    </div>
  {:else}
    <header class="arrival-heading">
      <h1>Know what rent fits before you move.</h1>
      <p>
        See what your salary makes possible, compare local rents, and leave room for everyday life.
      </p>
      <a class="landing-start" href="#plan-controls"
        >Build my rent plan <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          ><path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        ></a
      >
    </header>
  {/if}

  <!-- Render the controls once so selecting a city preserves input focus. -->
  <div class="landing-editor">
    {@render children?.()}
  </div>

  {#if !city && featuredCity && featuredImage}
    <figure
      class="featured-city"
      aria-label="Featured cities"
      aria-roledescription="carousel"
      onpointerenter={() => (hovered = true)}
      onpointerleave={() => (hovered = false)}
      onfocusin={() => (focused = true)}
      onfocusout={(event) => {
        focused =
          event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget);
      }}
    >
      <div class="featured-photo">
        {#key featuredCity.name}
          <img
            src={featuredImage.url}
            alt={featuredImage.alt}
            fetchpriority="high"
            transition:fade={{ duration: reducedMotion ? 0 : 700 }}
            onoutrostart={(event) => event.currentTarget.setAttribute('aria-hidden', 'true')}
            onerror={(event) => {
              if (event.currentTarget instanceof HTMLImageElement)
                event.currentTarget.style.visibility = 'hidden';
            }}
          />
        {/key}
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
          Photo: <a href={featuredImage.photographerUrl} target="_blank" rel="noopener"
            >{featuredImage.photographerName}</a
          >
          / <a href={featuredImage.sourceUrl} target="_blank" rel="noopener">Unsplash</a>
        </p>
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
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 1.5rem 0;
    align-items: stretch;
    padding-top: 0.5rem;
  }
  .arrival-heading {
    padding: 2rem 2.5rem;
    border: 1px solid var(--line);
    border-right: 0;
    border-radius: 0.75rem 0 0 0.75rem;
    background: var(--card);
  }
  .arrival-heading h1 {
    max-width: 20ch;
    font-size: clamp(2.375rem, 4vw, 3.5rem);
    font-weight: 600;
    line-height: 1.08;
    letter-spacing: -0.045em;
  }
  .arrival-heading p {
    max-width: 52ch;
    margin-top: 1rem;
    font-size: 1rem;
    line-height: 1.55;
    color: var(--muted);
  }
  .landing-start {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    border-radius: 999px;
    padding: 0.75rem 1.25rem;
    background: var(--primary);
    color: var(--primary-ink);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }
  .landing-start:hover {
    opacity: 0.85;
  }
  .landing .landing-editor {
    grid-column: 1 / -1;
  }
  .featured-city {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    min-width: 0;
    flex-direction: column;
    padding: 1.5rem;
    border: 1px solid var(--line);
    border-left: 0;
    border-radius: 0 0.75rem 0.75rem 0;
    background: var(--card);
  }
  .featured-photo {
    position: relative;
    flex: 1;
    min-height: 11rem;
    overflow: hidden;
    border-radius: 0.5rem;
    background: #27272a;
  }
  .featured-photo::after {
    content: '';
    position: absolute;
    inset: 25% 0 0;
    background: linear-gradient(transparent, rgb(0 0 0 / 88%));
    pointer-events: none;
  }
  .featured-photo img {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 48% center;
  }
  .featured-location {
    position: absolute;
    z-index: 1;
    right: 1rem;
    bottom: 2.5rem;
    left: 1rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
  }
  .featured-location svg {
    flex-shrink: 0;
  }
  .featured-credit {
    position: absolute;
    z-index: 1;
    right: 1rem;
    bottom: 0.75rem;
    left: 1rem;
    color: #ffffff;
    font-size: 0.6875rem;
    line-height: 1.3;
  }
  .featured-credit a {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .featured-caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 1rem;
  }
  .featured-rent span {
    display: block;
    margin-bottom: 0.25rem;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .featured-rent strong {
    font-size: 1.375rem;
    font-weight: 600;
    letter-spacing: -0.035em;
    font-variant-numeric: tabular-nums;
  }
  .featured-rent small {
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0;
  }
  .featured-explore {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0.5rem 0.75rem;
    color: var(--ink);
    font-size: 0.75rem;
    font-weight: 500;
    text-decoration: none;
  }
  .featured-explore svg {
    flex-shrink: 0;
  }
  .featured-explore:hover {
    border-color: var(--line-strong);
    background: var(--card-2);
  }
  .featured-caption > p {
    flex-basis: 100%;
    color: var(--muted);
    font-size: 0.6875rem;
    line-height: 1.4;
  }
  .city-arrival {
    margin: 1rem 0;
  }
  @media (max-width: 1100px) {
    .landing {
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    }
    .arrival-heading {
      padding: 2rem;
    }
    .featured-city {
      padding: 1.25rem;
    }
  }
  @media (max-width: 800px) {
    .landing {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.25rem;
    }
    .arrival-heading {
      padding: 1.5rem;
      border-right: 1px solid var(--line);
      border-radius: 0.5rem;
    }
    .arrival-heading h1 {
      font-size: clamp(2.375rem, 6vw, 3rem);
    }
    .featured-city {
      grid-column: 1;
      grid-row: 3;
      border-left: 1px solid var(--line);
      border-radius: 0.5rem;
    }
    .featured-photo {
      min-height: 12rem;
    }
    .featured-credit {
      font-size: 0.6875rem;
    }
  }
</style>
