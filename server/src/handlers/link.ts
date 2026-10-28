import { Hono } from 'hono';
import type { Env } from '../env';

// Google maps links copied on a phone are short links; where they lead is only
// readable with a redirect chain, which a browser cannot follow across origins.
// Only these hosts are ever fetched, and only the final URL is returned.
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

export const linkApp = new Hono<{ Bindings: Env }>().get('/', async (c) => {
  const raw = c.req.query('url') ?? '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return c.json({ error: 'Not a link.' }, 400);
  }

  for (let hop = 0; hop < 5 && SHORT_HOSTS.has(url.hostname); hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) }).catch(
      () => null
    );
    const location = res?.headers.get('location');
    if (!location) break;
    url = new URL(location, url);
  }

  return c.json({ url: url.toString() });
});
