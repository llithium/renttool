<script lang="ts">
  import 'leaflet/dist/leaflet.css';
  import { onMount } from 'svelte';
  import type { City } from '$lib/types';
  import type { Map as LMap, LayerGroup, CircleMarker } from 'leaflet';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';
  import { markerPresentation, reconcileMarkerKeys, type MarkerPalette } from './rentMapMarkers';

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
  let disposed = false;

  const markers = new Map<string, CircleMarker>();
  const tooltipParts = new Map<string, { title: HTMLElement; detail: Text }>();

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

  type LocatedCity = City & { lat: number; lng: number };

  function hasCoordinates(city: City): city is LocatedCity {
    return city.lat != null && city.lng != null;
  }

  function createMarker(city: LocatedCity, palette: MarkerPalette, targetGroup: LayerGroup) {
    const initial = markerPresentation(city, null, null, palette);
    const marker = L.circleMarker([city.lat, city.lng], {
      radius: initial.radius,
      weight: initial.weight,
      color: initial.color,
      fillColor: initial.fillColor,
      fillOpacity: initial.fillOpacity
    });
    const tooltip = document.createElement('div');
    const title = document.createElement('strong');
    const detail = document.createTextNode(initial.tooltipDetail);
    title.textContent = city.name;
    tooltip.append(title, document.createElement('br'), detail);
    marker.bindTooltip(tooltip, { direction: 'top' });
    marker.on('click', () => presentation.selectCity(city.name));
    marker.addTo(targetGroup);
    const element = marker.getElement();
    if (element) {
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', initial.ariaLabel);
      element.addEventListener('keydown', (event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          keyboardEvent.preventDefault();
          presentation.selectCity(city.name);
        }
      });
    }
    tooltipParts.set(city.name, { title, detail });
    return marker;
  }

  function applyMarkerPresentation(city: City, marker: CircleMarker, palette: MarkerPalette) {
    const next = markerPresentation(city, maxRent, selectedName, palette);
    marker.setRadius(next.radius);
    marker.setStyle({
      weight: next.weight,
      color: next.color,
      fillColor: next.fillColor,
      fillOpacity: next.fillOpacity
    });
    const parts = tooltipParts.get(city.name);
    if (parts) {
      parts.title.textContent = city.name;
      parts.detail.data = next.tooltipDetail;
    }
    const element = marker.getElement();
    element?.setAttribute('aria-label', next.ariaLabel);
  }

  function reconcileMarkers() {
    if (!ready || !group || !L) return;

    const locatedCities = cities.filter(hasCoordinates);
    const citiesByName = new Map(locatedCities.map((city) => [city.name, city]));
    const changes = reconcileMarkerKeys(markers.keys(), cities);
    const coordinatesChanged = changes.retained.some((name) => {
      const city = citiesByName.get(name);
      const marker = markers.get(name);
      if (!city || !marker) return false;
      const point = marker.getLatLng();
      return point.lat !== city.lat || point.lng !== city.lng;
    });
    const hasStructuralChange =
      changes.added.length > 0 || changes.removed.length > 0 || coordinatesChanged;
    if (!hasStructuralChange) return;

    // Reconciliation retains marker elements and their listeners. If a focused
    // marker is removed, restore focus to the selected marker or map container.
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

    // Cancel any in-flight pan/zoom animation before changing marker geometry.
    map?.stop();
    for (const name of changes.removed) {
      const marker = markers.get(name);
      if (!marker) continue;
      group.removeLayer(marker);
      markers.delete(name);
      tooltipParts.delete(name);
    }

    for (const name of changes.retained) {
      const city = citiesByName.get(name);
      const marker = markers.get(name);
      if (!city || !marker) continue;
      const point = marker.getLatLng();
      if (point.lat !== city.lat || point.lng !== city.lng) {
        marker.setLatLng([city.lat, city.lng]);
      }
    }

    const palette = markerPalette();
    for (const name of changes.added) {
      const city = citiesByName.get(name);
      if (!city) continue;
      markers.set(name, createMarker(city, palette, group));
    }

    if (hadFocus && focusName && !markers.has(focusName)) {
      const target =
        (selectedName && markers.get(selectedName)?.getElement()) || map?.getContainer();
      (target as HTMLElement | undefined)?.focus({ preventScroll: true });
    }
  }

  function updateMarkerPresentation() {
    if (!ready || !group) return;
    const palette = markerPalette();
    for (const city of cities) {
      if (!hasCoordinates(city)) continue;
      const marker = markers.get(city.name);
      if (marker) applyMarkerPresentation(city, marker, palette);
    }
  }

  onMount(() => {
    void import('leaflet')
      .then((leaflet) => {
        if (disposed) return;
        L = leaflet.default ?? leaflet;
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
        reconcileMarkers();
        updateMarkerPresentation();
      })
      .catch(() => {
        // Leaflet is an enhancement; keep the rest of the city view usable if it fails to load.
        ready = false;
      });

    return () => {
      disposed = true;
      map?.remove();
    };
  });

  // Reconcile marker identities only when the located city collection changes.
  $effect(() => {
    void ready;
    void cities;
    reconcileMarkers();
  });

  // Salary and selection changes update retained markers in place. Recentring is
  // deliberately separate so clicking a comparison row cannot be swallowed by
  // a marker presentation update.
  $effect(() => {
    void ready;
    void cities;
    void maxRent;
    void selectedName;
    updateMarkerPresentation();
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
