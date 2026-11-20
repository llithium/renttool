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

  const TILE_URL: Record<Tiles, string> = {
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    'light-nolabels': 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    'dark-nolabels': 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
  };

  let el: HTMLDivElement;
  let map: LMap | undefined;
  let group: LayerGroup | undefined;
  let L: typeof import('leaflet') | undefined;

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
      L.tileLayer(TILE_URL[tiles], {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 18
      }).addTo(map);
      group = L.layerGroup().addTo(map);
      draw();
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  });

  $effect(() => {
    void view;
    draw();
  });
</script>

<div bind:this={el} class="pm {klass}" role="region" aria-label={label}></div>

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
  .pm :global(.leaflet-control-attribution) {
    font-size: 10px;
    background: rgb(255 255 255 / 0.7);
  }
</style>
