import type { LayerSpecification, MapStyleImageMissingEvent, StyleSpecification } from 'maplibre-gl';
import { useMemo } from 'react';
import useSWR from 'swr';

const TILE_URL_LIGHT = 'https://resource.mwyndham.dev/sono/alidade_smooth_light.json';
const TILE_URL_DARK = 'https://resource.mwyndham.dev/sono/alidade_smooth_dark.json';

type Paint = Record<string, string>;

// The printed placemat: true-neutral land, white roads, blue water, green parks.
// shortcut: recolours Stadia's alidade layers by id at load, so an upstream rename silently drops a colour;
// publish the recoloured JSON to resource.mwyndham.dev when that happens.
const LIGHT: Record<string, Paint> = {
  background: { 'background-color': '#D6D6D6' },
  landuse_residential: { 'fill-color': '#D0D0D0' },
  park_fill: { 'fill-color': '#C9E2C1' },
  landcover_park: { 'fill-color': '#C9E2C1' },
  landcover_wood: { 'fill-color': '#BFDDB5' },
  water: { 'fill-color': '#8CC3EE' },
  waterway: { 'line-color': '#8CC3EE' },
  building: { 'fill-color': '#C6C6C6', 'fill-outline-color': '#BABABA' },
  highway_path: { 'line-color': '#E6E6E6' },
  highway_minor: { 'line-color': '#F4F4F4' },
  highway_major_casing: { 'line-color': '#A8A8A8' },
  highway_major_inner: { 'line-color': '#FFFFFF' },
  highway_major_subtle: { 'line-color': '#BDBDBD' },
  highway_motorway_casing: { 'line-color': '#8A8A8A' },
  highway_motorway_inner: { 'line-color': '#FFFFFF' },
  highway_motorway_subtle: { 'line-color': '#B0B0B0' },
  highway_motorway_bridge_casing: { 'line-color': '#8A8A8A' },
  highway_motorway_bridge_inner: { 'line-color': '#FFFFFF' },
  railway: { 'line-color': '#7A7A7A' },
  railway_dashline: { 'line-color': '#F4F4F4' },
  railway_service: { 'line-color': '#8A8A8A' },
  railway_service_dashline: { 'line-color': '#F4F4F4' },
};
const LIGHT_TEXT = { place: '#3D3D3D', highway: '#4A4A4A', water: '#2F6FA8', poi: '#6E6E6E', halo: '#E2E2E2' };

const DARK: Record<string, Paint> = {
  background: { 'background-color': '#262626' },
  landuse_residential: { 'fill-color': '#2B2B2B' },
  park_fill: { 'fill-color': '#25331F' },
  landcover_park: { 'fill-color': '#25331F' },
  landcover_wood: { 'fill-color': '#22301C' },
  water: { 'fill-color': '#1F3A52' },
  waterway: { 'line-color': '#1F3A52' },
  building: { 'fill-color': '#323232', 'fill-outline-color': '#3A3A3A' },
  highway_path: { 'line-color': '#333333' },
  highway_minor: { 'line-color': '#3C3C3C' },
  highway_major_casing: { 'line-color': '#1A1A1A' },
  highway_major_inner: { 'line-color': '#4A4A4A' },
  highway_motorway_casing: { 'line-color': '#141414' },
  highway_motorway_inner: { 'line-color': '#575757' },
  highway_motorway_bridge_casing: { 'line-color': '#141414' },
  highway_motorway_bridge_inner: { 'line-color': '#575757' },
  railway: { 'line-color': '#5A5A5A' },
  railway_dashline: { 'line-color': '#262626' },
};
const DARK_TEXT = { place: '#C4C4C4', highway: '#A8A8A8', water: '#6FA6D6', poi: '#8A8A8A', halo: '#1A1A1A' };

function textColor(id: string, text: typeof LIGHT_TEXT) {
  if (id.startsWith('place')) return text.place;
  if (id.startsWith('highway_name')) return text.highway;
  if (id.startsWith('water_name')) return text.water;
  if (id.startsWith('poi') || id.startsWith('airport')) return text.poi;
}

// Grain sits on the land, under roads and labels. Its image is added on 'styleimagemissing'.
const GRAIN: LayerSpecification = {
  id: 'grain',
  type: 'background',
  paint: { 'background-pattern': 'grain' },
};

function print(style: StyleSpecification, dark: boolean): StyleSpecification {
  const paints = dark ? DARK : LIGHT;
  const text = dark ? DARK_TEXT : LIGHT_TEXT;
  const layers = style.layers.flatMap((layer) => {
    const paint = { ...(layer.paint as Paint), ...paints[layer.id] };
    if (layer.type === 'symbol') {
      const color = textColor(layer.id, text);
      if (color) Object.assign(paint, { 'text-color': color, 'text-halo-color': text.halo });
    }
    const printed = { ...layer, paint } as LayerSpecification;
    return layer.id === 'building' ? [printed, GRAIN] : [printed];
  });
  return { ...style, layers };
}

export function usePrintedStyle(dark: boolean) {
  const url = dark ? TILE_URL_DARK : TILE_URL_LIGHT;
  const { data } = useSWR(url, async (u: string) => (await fetch(u)).json(), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  // Handed over as a URL: a style object races the shop layers, which then sometimes never draw.
  return useMemo(() => {
    if (!data) return undefined;
    const json = JSON.stringify(print(data as StyleSpecification, dark));
    return URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  }, [data, dark]);
}

// A 128px noise tile: black and white specks at low alpha read on both the day and night maps.
export function addGrain(e: MapStyleImageMissingEvent) {
  if (e.id !== 'grain' || e.target.hasImage('grain')) return;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    data.set([v, v, v, Math.random() * 22], i);
  }
  e.target.addImage('grain', { width: size, height: size, data });
}
