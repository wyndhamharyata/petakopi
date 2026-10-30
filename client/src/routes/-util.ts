import { useSyncExternalStore } from 'react';
import type { Coffee } from '@rpcTypes/coffee.ts';
import type { LatLng } from '@store/store.ts';

// Haversine, in metres.
export function distance([lat1, lng1]: LatLng, [lat2, lng2]: LatLng) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

export const at = (c: Coffee): LatLng => [c.lat, c.lng];

// The strip holds ten torn edges, 900px each; pick one by the shop, so no two papers
// tear the same way and the same shop always tears the same way.
export const tearAt = (seed: string | number) => {
  let h = 7;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `-${(Math.abs(h) % 10) * 900}px`;
};

// "Jl. Mojo No.23, Karangasem, Kec. Laweyan, Kota Surakarta" -> "Laweyan".
// Google's English format has no "Kec.": "CRJ8+9QG, Sriwedari, Laweyan, Surakarta City" -> the part before the city.
export const area = (address: string) => {
  const kec = address.match(/Kec(?:amatan|\.)\s*([^,]+)/i)?.[1].trim();
  if (kec) return kec.replace(/^Ps\.\s*/, 'Pasar ');
  const parts = address.split(',').map((p) => p.trim());
  const city = parts.findIndex((p) => /\b(City|Regency)\b|^(Kota|Kabupaten|Kab\.)\s/i.test(p));
  return parts[city > 0 ? city - 1 : 0];
};

export const formatHours = (hours: string) => hours.replace(/\s*-\s*/, ' – ');

export const directionsUrl = (c: Coffee) =>
  `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;

export const shopUrl = (c: Coffee) => `${location.origin}/?shop=${c.id}`;

// Single-key shortcuts must not fire while typing or with a modifier held.
export const isTypingTarget = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return (
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    !!t?.closest('input, textarea, select, [contenteditable="true"]')
  );
};

const DESKTOP = window.matchMedia('(min-width: 1024px)');
const WIDE = window.matchMedia('(min-width: 1280px)');
export const isDesktop = () => DESKTOP.matches;

const useMedia = (query: MediaQueryList) =>
  useSyncExternalStore(
    (onChange) => {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => query.matches
  );
// Desktop and mobile mount different trees, so the shop view's shortcuts never run twice.
export const useDesktop = () => useMedia(DESKTOP);
// Below this the receipt and a ticket leave the map too little room side by side.
export const useWide = () => useMedia(WIDE);

// A rubber stamp lands at a slight angle, the same for a shop every time: -4° to 4°.
export const tilt = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return { '--r': `${(Math.abs(h) % 9) - 4}deg` } as React.CSSProperties;
};
