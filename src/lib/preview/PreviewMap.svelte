<script lang="ts">
  import 'leaflet/dist/leaflet.css';
  import { onMount } from 'svelte';
  import type { Map as LMap, LayerGroup } from 'leaflet';
  import type { CityView, NearbyView } from './model';

  type Tiles = 'light' | 'dark' | 'voyager' | 'light-nolabels' | 'dark-nolabels';

  let {
    view,
    tiles = 'light',
    marker,
    center,
    zoom = 10,
    class: klass = '',
    label = 'Map of nearby cities',
    onpick
  }: {
    view: CityView;
    tiles?: Tiles;
    /** HTML for a nearby-city marker; style it with :global(.pm-marker) in the design. */
    marker: (place: NearbyView) => string;
    /** HTML for the active-city marker. */
    center: (view: CityView) => string;
    zoom?: number;
    class?: string;
    label?: string;
    onpick?: (name: string) => void;
  } = $props();

  // OpenStreetMap's standard tiles (already allowed by the app's CSP), restyled per design
  // with CSS filters so each preview keeps its own map tone without a keyed tile service.
  const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  let el: HTMLDivElement;
  let map: LMap | undefined;
  let group: LayerGroup | undefined;
  let L: typeof import('leaflet') | undefined;
  let ro: ResizeObserver | undefined;

  function draw() {
    if (!map || !group || !L) return;
    const Lf = L;
    group.clearLayers();
    const bounds = Lf.latLngBounds([[view.lat, view.lng]]);
    for (const place of view.nearby) {
      const m = Lf.marker([place.lat, place.lng], {
        icon: Lf.divIcon({ className: 'pm-wrap', html: marker(place), iconSize: [0, 0] }),
        keyboard: place.hasData,
        title: place.name
      });
      if (onpick && place.hasData) m.on('click', () => onpick(place.name));
      m.addTo(group);
      bounds.extend([place.lat, place.lng]);
    }
    Lf.marker([view.lat, view.lng], {
      icon: Lf.divIcon({ className: 'pm-wrap', html: center(view), iconSize: [0, 0] }),
      keyboard: false,
      zIndexOffset: 1000
    }).addTo(group);
    map.fitBounds(bounds.pad(0.18), { maxZoom: zoom + 1, animate: false });
  }

  onMount(() => {
    let cancelled = false;
    void import('leaflet').then((leaflet) => {
      if (cancelled) return;
      L = (leaflet as unknown as { default?: typeof import('leaflet') }).default ?? leaflet;
      map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false
      }).setView([view.lat, view.lng], zoom);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer(OSM_URL, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18
      }).addTo(map);
      group = L.layerGroup().addTo(map);
      draw();
      ro = new ResizeObserver(() => {
        map?.invalidateSize({ animate: false });
        draw();
      });
      ro.observe(el);
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
    };
  });

  $effect(() => {
    void view;
    draw();
  });
</script>

<div bind:this={el} class="pm tiles-{tiles} {klass}" role="region" aria-label={label}></div>

<style>
  .pm {
    width: 100%;
    height: 100%;
    background: transparent;
    font: inherit;
  }
  .pm :global(.pm-wrap) {
    background: none;
    border: 0;
    overflow: visible;
  }
  .tiles-light :global(.leaflet-tile-pane) {
    filter: grayscale(1) contrast(0.9) brightness(1.05);
  }
  .tiles-light-nolabels :global(.leaflet-tile-pane) {
    filter: grayscale(1) contrast(0.8) brightness(1.08);
  }
  .tiles-voyager :global(.leaflet-tile-pane) {
    filter: saturate(0.55) contrast(0.95) brightness(1.03);
  }
  .tiles-dark :global(.leaflet-tile-pane),
  .tiles-dark-nolabels :global(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) grayscale(0.85) brightness(0.8) contrast(0.95);
  }
  .pm :global(.leaflet-control-attribution) {
    font-size: 10px;
    background: rgb(255 255 255 / 0.7);
  }
</style>
