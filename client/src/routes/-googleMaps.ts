import type { Coffee } from '@rpcTypes/coffee.ts';
import type { LatLng } from '@store/store.ts';
import { client } from '@fetcher/fetcher.ts';
import { at, distance } from './-util.ts';

// Google maps links copied on a phone. Their target is behind a redirect the
// browser cannot read, so the worker follows it and returns the long link.
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

export type ImportedShop = { name: string; latLng: LatLng };

async function resolveShortLink(url: URL): Promise<URL | null> {
  const res = await client.api.link.$get({ query: { url: url.toString() } });
  if (!res.ok) return null;
  return new URL((await res.json()).url);
}

// A place link carries the shop name in its path and the pin in its data:
// "!3d/!4d" is the shop, "@lat,lng" is only where the map was looking.
export async function readGoogleMapsLink(raw: string): Promise<ImportedShop | null> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (SHORT_HOSTS.has(url.hostname)) {
    const resolved = await resolveShortLink(url).catch(() => null);
    if (!resolved) return null;
    url = resolved;
  }

  const href = url.href;
  const coords =
    href.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/) ?? href.match(/@(-?[\d.]+),(-?[\d.]+)/);
  if (!coords) return null;
  const lat = Number(coords[1]);
  const lng = Number(coords[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // ".../maps/place/Antara+kopi/@-7.5,110.8,17z"
  const segments = url.pathname.split('/').filter(Boolean);
  const place = segments[segments.indexOf('place') + 1];
  const name = decodeURIComponent(place ?? url.searchParams.get('q') ?? '')
    .replace(/\+/g, ' ')
    .trim();

  return { name, latLng: [lat, lng] };
}

// Shops count as duplicates only at the same location with a similar name.
export function findExistingShop(
  shops: Coffee[],
  { name, latLng }: ImportedShop
): Coffee | undefined {
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = key(name);
  if (!wanted) return undefined;
  return shops.find((shop) => {
    const existing = key(shop.name);
    return (
      distance(at(shop), latLng) < 40 &&
      (existing === wanted || existing.includes(wanted) || wanted.includes(existing))
    );
  });
}
