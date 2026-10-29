// Prints Kopimap's map styles: Stadia's alidade styles, recoloured as the Nota placemat.
// Run from client/: node scripts/print-map-style.mjs <out-dir>
// Then, from the repo root with .env loaded, for light and dark:
//   npx wrangler r2 object put mwyndham-dev/sono/kopimap_print_light.json --file <out-dir>/kopimap_print_light.json --content-type application/json --remote
import { writeFileSync } from 'node:fs';

const UPSTREAM = 'https://resource.mwyndham.dev/sono/alidade_smooth_';
// The bucket's CORS only answers the app's origin.
const ORIGIN = { origin: 'https://kopimap.mwyndham.dev' };

// The printed placemat: true-neutral land, white roads, blue water, green parks.
// Matched by Stadia's alidade layer ids: if upstream renames a layer, that layer keeps its old colour.
const LIGHT = {
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

const DARK = {
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

function textColor(id, text) {
  if (id.startsWith('place')) return text.place;
  if (id.startsWith('highway_name')) return text.highway;
  if (id.startsWith('water_name')) return text.water;
  if (id.startsWith('poi') || id.startsWith('airport')) return text.poi;
}

// Grain sits on the land, under roads and labels. Its image is added on 'styleimagemissing'.
const GRAIN = {
  id: 'grain',
  type: 'background',
  paint: { 'background-pattern': 'grain' },
};

function print(style, dark) {
  const paints = dark ? DARK : LIGHT;
  const text = dark ? DARK_TEXT : LIGHT_TEXT;
  const layers = style.layers.flatMap((layer) => {
    const paint = { ...layer.paint, ...paints[layer.id] };
    if (layer.type === 'symbol') {
      const color = textColor(layer.id, text);
      if (color) Object.assign(paint, { 'text-color': color, 'text-halo-color': text.halo });
    }
    const printed = { ...layer, paint };
    return layer.id === 'building' ? [printed, GRAIN] : [printed];
  });
  return { ...style, layers };
}


const out = process.argv[2] ?? '.';
for (const theme of ['light', 'dark']) {
  const res = await fetch(`${UPSTREAM}${theme}.json`, { headers: ORIGIN });
  if (!res.ok) throw new Error(`${theme}: ${res.status}`);
  const style = await res.json();
  const printed = print(style, theme === 'dark');
  const missing = Object.keys(theme === 'dark' ? DARK : LIGHT).filter((id) => !style.layers.some((l) => l.id === id));
  if (missing.length) throw new Error(`${theme}: upstream has no layer ${missing.join(', ')}`);
  writeFileSync(`${out}/kopimap_print_${theme}.json`, JSON.stringify(printed));
  console.log(`${out}/kopimap_print_${theme}.json`, printed.layers.length, 'layers');
}
