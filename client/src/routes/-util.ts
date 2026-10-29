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
export const isDesktop = () => DESKTOP.matches;

// Desktop and mobile mount different trees, so the shop view's shortcuts never run twice.
export const useDesktop = () =>
  useSyncExternalStore(
    (onChange) => {
      DESKTOP.addEventListener('change', onChange);
      return () => DESKTOP.removeEventListener('change', onChange);
    },
    isDesktop
  );
