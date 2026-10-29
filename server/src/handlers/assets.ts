// @ts-ignore
export async function HandleAssets(c) {
  try {
    // Try to serve the requested asset first
    const assetResponse = await c.env.ASSETS.fetch(c.req.url);

    // If the asset exists and is not a 404, return it
    if (assetResponse.status !== 404) {
      // Build files carry a content hash in their names, so a year is safe. Without this they
      // are revalidated on every visit, which costs a round trip per file on a phone.
      if (new URL(c.req.url).pathname.startsWith('/assets/')) {
        const cached = new Response(assetResponse.body, {
          status: assetResponse.status,
          statusText: assetResponse.statusText,
          headers: assetResponse.headers,
        });
        cached.headers.set('cache-control', 'public, max-age=31536000, immutable');
        return cached;
      }
      return assetResponse;
    }

    // If asset doesn't exist, serve index.html for client-side routing
    const indexResponse = await c.env.ASSETS.fetch(new URL('/', c.req.url));
    return c.html(await indexResponse.text());
  } catch (error) {
    // Fallback to serving index.html if anything goes wrong
    const indexResponse = await c.env.ASSETS.fetch(new URL('/', c.req.url));
    return c.html(await indexResponse.text());
  }
}
