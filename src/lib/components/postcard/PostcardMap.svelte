<script lang="ts">
  import 'leaflet/dist/leaflet.css';
  import { onMount, untrack } from 'svelte';
  import type { City } from '$lib/types';
  import type { Map as LMap, LayerGroup, Marker } from 'leaflet';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import { markerPresentation, reconcileMarkerKeys } from '$lib/map/markers';
  import { googleMapsUrl } from '$lib/postcard';

  /**
   * The map on the back of the city postcard. Every located city is a pin
   * coloured like the stamp (pink fits, white tight, slate over), labelled with
   * its rent once the map is zoomed in far enough to read the labels.
   */
  let { presentation }: { presentation: RentPlanPresentation } = $props();

  let cities = $derived(presentation.cities);
  let ceiling = $derived(presentation.rentTarget);
  let selectedName = $derived(presentation.selectedName);
  let selectedCity = $derived(presentation.activeCity);
  let focusRequest = $derived(presentation.mapFocusRequest);
  let housing = $derived(presentation.options.housing);
  let destination = $derived(presentation.commute.destination);

  const LABEL_ZOOM = 9;
  let el: HTMLDivElement;
  let map: LMap | undefined;
  let group: LayerGroup | undefined;
  let L: typeof import('leaflet');
  let ready = $state(false);
  let labels = $state(true);
  let destinationMarker: Marker | undefined;
  let centeredName: string | null = null;
  let handledFocusRequest = 0;
  let disposed = false;
  const rentCheckController = new AbortController();
  const attemptedRentChecks = new Set<string>();
  let pendingRentNames = $state<string[]>([]);
  const markers = new Map<string, Marker>();

  type LocatedCity = City & { lat: number; lng: number };
  const hasCoordinates = (city: City): city is LocatedCity => city.lat != null && city.lng != null;

  function recenter(force = false) {
    const city = selectedName ? cities.find((c) => c.name === selectedName) : null;
    if (!map || !city || !hasCoordinates(city) || (!force && centeredName === city.name)) {
      if (!city) centeredName = null;
      return;
    }
    centeredName = city.name;
    if (destination) {
      map.fitBounds(
        [
          [city.lat, city.lng],
          [destination.lat, destination.lng]
        ],
        { padding: [48, 48], maxZoom: 11, animate: false }
      );
    } else {
      map.setView([city.lat, city.lng], 10, { animate: false });
    }
  }

  function checkMissingRents() {
    if (!ready || !map || disposed || (selectedName && centeredName !== selectedName)) return;
    const bounds = map.getBounds();
    for (const city of cities) {
      if (
        !hasCoordinates(city) ||
        city.source === 'apartment-list' ||
        city.r1 != null ||
        city.r2 != null ||
        !bounds.contains([city.lat, city.lng])
      )
        continue;
      const key = `${city.name}:${city.lat}:${city.lng}`;
      if (attemptedRentChecks.has(key)) continue;
      attemptedRentChecks.add(key);
      pendingRentNames = [...pendingRentNames, city.name];
      void presentation
        .checkRent(
          {
            label: city.name,
            city: city.city,
            state: city.state,
            lat: city.lat,
            lng: city.lng,
            pop: city.pop
          },
          rentCheckController.signal
        )
        .finally(() => {
          if (disposed) return;
          pendingRentNames = pendingRentNames.filter((name) => name !== city.name);
        });
    }
  }

  function pinHtml(city: City) {
    const root = document.createElement('span');
    root.className = 'pc-pin';
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'pc-pin-label';
    label.setAttribute('aria-hidden', 'true');
    const name = document.createElement('b');
    name.textContent = city.city;
    const rent = document.createElement('span');
    rent.className = 'pc-pin-rent';
    label.append(name, rent);
    root.append(dot, label);
    return root;
  }

  function createMarker(city: LocatedCity, target: LayerGroup) {
    const marker = L.marker([city.lat, city.lng], {
      icon: L.divIcon({
        className: 'pc-pin-icon',
        html: pinHtml(city),
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      }),
      keyboard: true,
      riseOnHover: true
    });
    marker.on('click', () => presentation.selectCity(city.name));
    marker.addTo(target);
    const element = marker.getElement();
    element?.setAttribute('role', 'button');
    element?.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === ' ') {
        event.preventDefault();
        presentation.selectCity(city.name);
      }
    });
    return marker;
  }

  function present(city: City, marker: Marker) {
    void ceiling;
    const pin = markerPresentation(
      city,
      presentation.rentTargetForCity(city),
      selectedName,
      housing,
      pendingRentNames.includes(city.name)
    );
    const element = marker.getElement();
    if (!element) return;
    const root = element.querySelector<HTMLElement>('.pc-pin');
    root?.setAttribute('data-state', pin.state);
    root?.setAttribute('data-selected', String(pin.selected));
    const rent = element.querySelector<HTMLElement>('.pc-pin-rent');
    if (rent) rent.textContent = pin.rentText;
    element.setAttribute('aria-label', pin.ariaLabel);
    element.setAttribute('title', pin.ariaLabel);
    marker.setZIndexOffset(pin.selected ? 1000 : pin.state === 'unknown' ? -100 : 0);
  }

  function reconcile() {
    if (!ready || !group || !L) return;
    const located = cities.filter(hasCoordinates);
    const byName = new Map(located.map((city) => [city.name, city]));
    const changes = reconcileMarkerKeys(markers.keys(), cities);
    const moved = changes.retained.some((name) => {
      const city = byName.get(name);
      const point = markers.get(name)?.getLatLng();
      return city && point && (point.lat !== city.lat || point.lng !== city.lng);
    });
    if (!changes.added.length && !changes.removed.length && !moved) return;
    map?.stop();
    const hadFocus = el.contains(document.activeElement);
    for (const name of changes.removed) {
      const marker = markers.get(name);
      if (marker) group.removeLayer(marker);
      markers.delete(name);
    }
    for (const name of changes.retained) {
      const city = byName.get(name);
      const marker = markers.get(name);
      const point = marker?.getLatLng();
      if (city && marker && point && (point.lat !== city.lat || point.lng !== city.lng))
        marker.setLatLng([city.lat, city.lng]);
    }
    for (const name of changes.added) {
      const city = byName.get(name);
      if (city) markers.set(name, createMarker(city, group));
    }
    if (hadFocus && !el.contains(document.activeElement)) {
      const target =
        (selectedName && markers.get(selectedName)?.getElement()) || map?.getContainer();
      (target as HTMLElement | undefined)?.focus({ preventScroll: true });
    }
  }

  function presentAll() {
    if (!ready) return;
    for (const city of cities) {
      const marker = markers.get(city.name);
      if (marker) present(city, marker);
    }
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) map?.invalidateSize({ animate: false });
    });
    resizeObserver.observe(el);
    void import('leaflet')
      .then((leaflet) => {
        if (disposed) return;
        L = leaflet.default ?? leaflet;
        // Animated zooms interrupted by a recentre leave pins detached from their
        // coordinates, so zoom in discrete steps.
        map = L.map(el, {
          scrollWheelZoom: false,
          attributionControl: true,
          zoomAnimation: false
        }).setView([39.5, -96], 4);
        // Wheel zoom only once focus is inside the map, so the page never gets trapped.
        const container = map.getContainer();
        container.addEventListener('focusin', () => map?.scrollWheelZoom.enable());
        container.addEventListener('focusout', (event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !container.contains(next)) map?.scrollWheelZoom.disable();
        });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          referrerPolicy: 'strict-origin-when-cross-origin',
          maxZoom: 19
        }).addTo(map);
        group = L.layerGroup().addTo(map);
        map.on('moveend', checkMissingRents);
        map.on('zoomend', () => (labels = (map?.getZoom() ?? 0) >= LABEL_ZOOM));
        ready = true;
        reconcile();
        presentAll();
      })
      .catch(() => {
        // The map is an enhancement; the rest of the postcard works without it.
        ready = false;
      });
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      rentCheckController.abort();
      map?.remove();
    };
  });

  $effect(() => {
    void ready;
    void cities;
    reconcile();
  });

  $effect(() => {
    void ready;
    void cities;
    void ceiling;
    void housing;
    void selectedName;
    void pendingRentNames;
    presentAll();
  });

  $effect(() => {
    void ready;
    void cities;
    void selectedName;
    recenter();
  });

  $effect(() => {
    void cities;
    if (!ready || focusRequest === handledFocusRequest) return;
    handledFocusRequest = focusRequest;
    recenter(true);
  });

  $effect(() => {
    if (!ready || !map) return;
    const target = destination;
    destinationMarker?.remove();
    destinationMarker = undefined;
    if (target) {
      destinationMarker = L.marker([target.lat, target.lng], {
        title: `Commute destination: ${target.label}`,
        alt: `Commute destination: ${target.label}`,
        zIndexOffset: 2000,
        icon: L.divIcon({
          className: 'pc-dest-pin',
          html: '<svg aria-hidden="true" viewBox="0 0 28 36" width="28" height="36"><path d="M14 35S1 22 1 14a13 13 0 0 1 26 0c0 8-13 21-13 21Z" fill="#17263B" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#F4A6B4"/></svg>',
          iconSize: [28, 36],
          iconAnchor: [14, 35]
        })
      }).addTo(map);
      destinationMarker
        .getElement()
        ?.setAttribute('aria-label', `Commute destination: ${target.label}`);
    }
    untrack(() => recenter(true));
  });

  $effect(() => {
    void ready;
    void cities;
    untrack(checkMissingRents);
  });
</script>

<div class="pc-map" data-labels={labels ? 'true' : 'false'}>
  <div
    bind:this={el}
    class="pc-map-canvas"
    role="region"
    aria-label="Map of nearby towns, coloured by whether rent fits your ceiling"
    data-testid="rent-map"
  ></div>
  {#if selectedCity}
    <a class="pc-map-link" href={googleMapsUrl(selectedCity)} target="_blank" rel="noopener"
      >Open in Google Maps</a
    >
  {/if}
</div>

<style>
  .pc-map {
    position: relative;
    min-height: 27.5rem;
    flex: 1;
    overflow: hidden;
    border-radius: 6px;
    background: #eef2f4;
  }
  .pc-map-canvas {
    position: absolute;
    inset: 0;
    background: #eef2f4;
    font: inherit;
  }
  /* Quiet the tiles so the pins carry the colour. */
  .pc-map :global(.leaflet-tile-pane) {
    filter: grayscale(1) contrast(0.82) brightness(1.08);
  }
  .pc-map :global(.leaflet-control-attribution) {
    background: rgb(255 255 255 / 85%);
    color: var(--muted);
    font-size: 11px;
  }
  .pc-map :global(.leaflet-control-zoom a) {
    color: var(--navy);
  }
  .pc-map-link {
    position: absolute;
    bottom: 0.625rem;
    left: 0.625rem;
    z-index: 500;
    display: inline-flex;
    height: 2.5rem;
    align-items: center;
    padding: 0 0.875rem;
    border-radius: 999px;
    background: var(--navy);
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 600;
    text-decoration: none;
  }
  .pc-map-link:hover {
    background: var(--navy-hover);
  }
  .pc-map-link:focus-visible {
    outline-color: var(--pink);
  }

  .pc-map :global(.pc-pin-icon) {
    background: none;
    border: 0;
  }
  .pc-map :global(.pc-pin-icon:focus) {
    outline: none;
  }
  .pc-map :global(.pc-pin-icon:focus-visible) {
    outline: 3px solid var(--navy);
    outline-offset: 3px;
    border-radius: 50%;
  }
  .pc-map :global(.pc-pin) {
    position: relative;
    display: block;
    width: 22px;
    height: 22px;
  }
  .pc-map :global(.pc-pin > i) {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16px;
    height: 16px;
    box-sizing: border-box;
    border: 2.5px solid var(--navy);
    border-radius: 50%;
    background: var(--pink);
    transform: translate(-50%, -50%);
  }
  .pc-map :global(.pc-pin[data-state='near'] > i) {
    border-width: 4px;
    background: #fff;
  }
  .pc-map :global(.pc-pin[data-state='above'] > i) {
    width: 14px;
    height: 14px;
    border: 2px solid var(--slate-ink);
    border-radius: 2px;
    background: var(--slate);
    transform: translate(-50%, -50%) rotate(45deg);
  }
  .pc-map :global(.pc-pin[data-state='unknown'] > i),
  .pc-map :global(.pc-pin[data-state='checking'] > i),
  .pc-map :global(.pc-pin[data-state='no-salary'] > i) {
    width: 12px;
    height: 12px;
    border: 2px dashed var(--slate-ink);
    background: #fff;
  }
  .pc-map :global(.pc-pin[data-state='no-salary'] > i) {
    border-style: solid;
    border-color: var(--navy);
  }
  .pc-map :global(.pc-pin[data-selected='true'] > i) {
    width: 26px;
    height: 26px;
    border-width: 5px;
  }
  .pc-map :global(.pc-pin-label) {
    position: absolute;
    top: 50%;
    left: 22px;
    display: none;
    transform: translateY(-50%);
    color: var(--navy);
    font-size: 13px;
    line-height: 1.15;
    white-space: nowrap;
    pointer-events: none;
    text-shadow:
      0 0 3px #fff,
      0 0 3px #fff,
      0 0 3px #fff,
      0 0 3px #fff;
  }
  .pc-map :global(.pc-pin-label b) {
    display: block;
    font-weight: 600;
  }
  .pc-map :global(.pc-pin-rent) {
    display: block;
  }
  .pc-map[data-labels='true'] :global(.pc-pin:not([data-state='unknown']) .pc-pin-label),
  .pc-map :global(.pc-pin[data-selected='true'] .pc-pin-label) {
    display: block;
  }
  .pc-map :global(.pc-pin[data-selected='true'] .pc-pin-label) {
    left: 30px;
    font-size: 16px;
  }
  .pc-map :global(.pc-pin[data-selected='true'] .pc-pin-label b) {
    font-weight: 700;
  }
  .pc-map :global(.pc-pin[data-selected='true'] .pc-pin-rent) {
    display: none;
  }
  .pc-map :global(.pc-dest-pin) {
    background: none;
    border: 0;
  }
  @media (max-width: 600px) {
    .pc-map {
      min-height: 20rem;
    }
  }
</style>
