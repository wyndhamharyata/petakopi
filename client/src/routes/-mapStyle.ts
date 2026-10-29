import type { MapStyleImageMissingEvent } from 'maplibre-gl';

// The printed placemat, made from Stadia's alidade styles by scripts/print-map-style.mjs.
export const TILE_URL_LIGHT = 'https://resource.mwyndham.dev/sono/kopimap_print_light.json';
export const TILE_URL_DARK = 'https://resource.mwyndham.dev/sono/kopimap_print_dark.json';

// A 128px noise tile for the style's grain layer: black and white specks at low alpha read on
// both the day and night maps.
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
