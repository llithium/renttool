<script lang="ts">
  import 'leaflet/dist/leaflet.css';
  import { onMount, onDestroy } from 'svelte';
  import type { City } from '$lib/types';
  import { money } from '$lib/format';
  import type { Map as LMap, LayerGroup, CircleMarker } from 'leaflet';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';

  let {
    presentation,
    class: className = ''
  }: {
    presentation: RentPlanPresentation;
    class?: string;
  } = $props();

  let cities = $derived(presentation.cities);
  let maxRent = $derived(presentation.rentTarget);
  let selectedName = $derived(presentation.selectedName);
  let focusRequest = $derived(presentation.mapFocusRequest);

  let el: HTMLDivElement;
  let map: LMap | undefined;
  let group: LayerGroup | undefined;
  let L: typeof import('leaflet');
  let ready = $state(false);
  let centeredName: string | null = null;
  let handledFocusRequest = 0;

  const markers = new Map<string, CircleMarker>();

  type MarkerPalette = {
    neutral: string;
    fits: string;
    over: string;
    accent: string;
    card: string;
  };

  function themeColor(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function markerPalette(): MarkerPalette {
    return {
      neutral: themeColor('--faint', '#777777'),
      fits: themeColor('--green', '#3f3f3f'),
      over: themeColor('--red', '#707070'),
      accent: themeColor('--accent', '#151515'),
      card: themeColor('--card', '#ffffff')
    };
  }

  function colorFor(c: City, palette: MarkerPalette): string {
    if (c.r1 == null || maxRent == null) return palette.neutral;
    return c.r1 <= maxRent ? palette.fits : palette.over;
  }

  function recenterOnSelectedCity(force = false) {
    const selectedCity = selectedName ? cities.find((c) => c.name === selectedName) : null;
    if (
      !map ||
      !selectedCity ||
      selectedCity.lat == null ||
      selectedCity.lng == null ||
      (!force && centeredName === selectedCity.name)
    ) {
      if (!selectedCity) centeredName = null;
      return;
    }

    map.setView([selectedCity.lat, selectedCity.lng], 8, { animate: false });
    centeredName = selectedCity.name;
  }

  function draw() {
    if (!ready || !group || !L) return;
    // Every redraw replaces the marker elements. If focus was inside the map
    // (wheel zoom is focus-gated), remember which marker held it so it can be
    // restored afterwards — otherwise focus falls to <body> and the wheel detaches.
    const active = document.activeElement;
    const hadFocus = el.contains(active);
    let focusName: string | null = null;
    if (hadFocus) {
      for (const [n, m] of markers) {
        if (m.getElement() === active) {
          focusName = n;
          break;
        }
      }
    }
    // Cancel any in-flight pan/zoom animation: re-adding vector markers while one
    // runs (or interrupting it afterwards) leaves them offset from the tiles.
    map?.stop();
    group.clearLayers();
    markers.clear();
    const palette = markerPalette();

    for (const c of cities) {
      if (c.lat == null || c.lng == null) continue;
      const selected = c.name === selectedName;
      const marker = L.circleMarker([c.lat, c.lng], {
        radius: selected ? 9 : 5.5,
        weight: selected ? 3 : 1.5,
        color: selected ? palette.accent : palette.card,
        fillColor: colorFor(c, palette),
        fillOpacity: 0.9
      });
      const fit =
        maxRent != null && c.r1 != null
          ? c.r1 <= maxRent
            ? 'fits budget'
            : 'over budget'
          : 'rent data unavailable';
      const tooltip = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = c.name;
      tooltip.append(strong, document.createElement('br'));
      tooltip.append(document.createTextNode(`1BR ${money(c.r1)} · ${fit}`));
      marker.bindTooltip(tooltip, { direction: 'top' });
      marker.on('click', () => presentation.selectCity(c.name));
      marker.addTo(group);
      const element = marker.getElement();
      if (element) {
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', `${c.name}, 1 bedroom ${money(c.r1)}, ${fit}`);
        element.addEventListener('keydown', (event) => {
          const keyboardEvent = event as KeyboardEvent;
          if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
            keyboardEvent.preventDefault();
            presentation.selectCity(c.name);
          }
        });
      }
      markers.set(c.name, marker);
    }

    if (hadFocus) {
      // Same marker if it still exists, else the selected one, else the container.
      // preventScroll, or the focus call scrolls the overflow-hidden container
      // and shifts every marker off its coordinates.
      const target =
        (focusName && markers.get(focusName)?.getElement()) ||
        (selectedName && markers.get(selectedName)?.getElement()) ||
        map?.getContainer();
      (target as HTMLElement | undefined)?.focus({ preventScroll: true });
    }
  }

  onMount(async () => {
    L = (await import('leaflet')).default ?? (await import('leaflet'));
    // zoomAnimation off: an interrupted zoom animation (wheel during the
    // select-recenter, or vice versa) leaves the SVG marker pane with a stale
    // transform, detaching markers from their coordinates. Discrete zoom steps
    // have no animation window to corrupt.
    map = L.map(el, {
      scrollWheelZoom: false,
      attributionControl: true,
      zoomAnimation: false
    }).setView([39.5, -96], 4);
    // Wheel scrolling passes through to the page until focus is inside the map
    // (click or keyboard), so it never traps the page scroll unintentionally.
    // focusin/focusout, not Leaflet's focus/blur: those only watch the container
    // element itself, and focus usually sits on a marker inside it.
    const container = map.getContainer();
    container.addEventListener('focusin', () => map?.scrollWheelZoom.enable());
    container.addEventListener('focusout', (event) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !container.contains(next)) {
        map?.scrollWheelZoom.disable();
      }
    });
    // CARTO Positron: a light, low-detail basemap so the affordability markers stand out.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    group = L.layerGroup().addTo(map);
    ready = true;
    draw();
  });

  onDestroy(() => {
    map?.remove();
  });

  // Redraw markers when data, budget, or selection changes. Recentring is
  // deliberately separate so clicking a comparison row cannot be swallowed by
  // a marker redraw.
  $effect(() => {
    // touch reactive deps
    void cities;
    void maxRent;
    void selectedName;
    draw();
  });

  // A newly selected comparison city is a navigation action, so move the map
  // to it even when the marker collection itself has not changed.
  $effect(() => {
    void ready;
    void cities;
    void selectedName;
    recenterOnSelectedCity();
  });

  // Comparison-table clicks carry an explicit focus request. This also recentres
  // a city already selected after the user has panned the map elsewhere.
  $effect(() => {
    void cities;
    if (!ready || focusRequest === handledFocusRequest) return;
    handledFocusRequest = focusRequest;
    recenterOnSelectedCity(true);
  });
</script>

<section class={className}>
  <SectionHeading title="Affordability map">
    <div class="flex gap-3.5 text-xs text-muted">
      <div class="flex flex-wrap justify-end gap-x-3.5 gap-y-1">
        {#if selectedName}
          <span class="inline-flex items-center gap-1.5 font-semibold text-ink">
            <i class="inline-block size-2.5 rounded-full border-2 border-accent bg-card"></i>
            Current city:
            {selectedName}
          </span>
        {/if}
        <span class="inline-flex items-center gap-1.5">
          <i class="inline-block size-2.5 rounded-full bg-green"></i> fits budget
        </span>
        <span class="inline-flex items-center gap-1.5">
          <i class="inline-block size-2.5 rounded-full bg-red"></i> over budget
        </span>
      </div>
    </div>
  </SectionHeading>
  <div
    bind:this={el}
    class="leaflet-theme h-100 w-full overflow-hidden rounded-xl border border-line bg-card-2"
  ></div>
  <p class="mt-3 text-xs/relaxed text-muted">
    Your current plan stays centered and labelled. Select another marker to load that city.
  </p>
</section>

<style>
  /* Leaflet renders its own DOM outside our markup, so its tooltip chrome and
     focus rings can only be reached with real selectors. */
  .leaflet-theme :global(.leaflet-tooltip) {
    background: var(--card);
    color: var(--ink);
    border: 1px solid var(--line-strong);
    box-shadow: var(--elevation-card);
    font-size: 0.875rem;
  }
  .leaflet-theme :global(.leaflet-tooltip-top::before) {
    border-top-color: var(--line-strong);
  }
  /* No focus square when a marker is focused by click or by the post-select focus
     restore; keyboard users still get a visible ring via :focus-visible below.
     That ring has to be repeated here rather than left to app.css: this scoped
     block is unlayered, and unlayered declarations beat anything in @layer base
     whatever the specificity, so the `outline: none` above would otherwise swallow
     the base ring for keyboard users too. */
  .leaflet-theme :global(.leaflet-interactive:focus) {
    outline: none;
  }
  .leaflet-theme :global(.leaflet-interactive:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
