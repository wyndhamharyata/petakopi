import { getDB } from '../db';
import { sql } from 'kysely';
import { Coffee, ModifyCoffeeReqSchema } from '@rpcTypes/coffee';
import { uuidv7 } from 'uuidv7';
import { type InferOutput } from 'valibot';
import { type OpenHour } from '@rpcTypes/openHour';

export async function coffeeById(id: string) {
  const db = await getDB();
  const coffee = await db
    .selectFrom('coffees')
    .where('coffees.id', '=', id)
    .selectAll()
    .executeTakeFirst();

  return { coffee: coffee };
}

export async function coffees() {
  const db = await getDB();
  return await db.selectFrom('coffees').selectAll().execute();
}

export async function latestReviews() {
  const db = await getDB();
  return await db
    .selectFrom('coffees')
    .selectAll()
    .where('coffees.status', '=', 'reviewed')
    .orderBy('coffees.updated_at', 'desc')
    .execute();
}

export async function search(queryParam: string | undefined) {
  const db = await getDB();
  const queryString = `%${queryParam?.trim() ?? ''}%`;

  const coffees = await db
    .selectFrom('coffees')
    .selectAll()
    // @formatter:off
    .where((q) =>
      q.or([
        q(sql`lower(coffees.name)`, 'like', sql`${queryString.toLowerCase()}`),
        q(
          sql`lower(coffees.address)`,
          'like',
          sql`${queryString.toLowerCase()}`
        ),
      ])
    )
    // @formatter:on
    .orderBy('coffees.created_at', 'desc')
    .execute();

  console.log(coffees);

  return coffees;
}

export async function review(id: string) {
  // marknotes prerenders both for each article whose frontmatter sets `coffeeId`.
  const [meta, embed] = await Promise.all([
    fetch(`https://mwyndham.dev/api/coffee-reviews/${encodeURIComponent(id)}.json`),
    fetch(`https://mwyndham.dev/embed/coffee/${encodeURIComponent(id)}`),
  ]);
  if (!meta.ok || !embed.ok) return { post: null };

  const post = (await meta.json()) as {
    slug: string;
    title: string;
    description: string;
    url: string;
    heroImage?: string;
  };
  // Astro writes site-relative asset URLs; the card renders on kopimap.
  const html = (await embed.text())
    .split('="/')
    .join('="https://mwyndham.dev/')
    .split(', /_astro/')
    .join(', https://mwyndham.dev/_astro/');
  return { post: { ...post, html } };
}

export async function editCoffeeShop(
  data: InferOutput<typeof ModifyCoffeeReqSchema>,
  id: string
) {
  const db = await getDB();

  const result = await db
    .updateTable('coffees')
    .set(mapModifyReqToCoffee(id, data))
    .where('coffees.id', '=', id)
    .executeTakeFirst();

  return {
    success: !!(result.numUpdatedRows ?? 0n > 0n),
    id: id,
  };
}

export async function createCoffeeShop(
  data: InferOutput<typeof ModifyCoffeeReqSchema>
) {
  const db = await getDB();
  const id = uuidv7();
  const result = await db
    .insertInto('coffees')
    .values(mapModifyReqToCoffee(id, data))
    .executeTakeFirst();

  return {
    success: !!(result.numInsertedOrUpdatedRows ?? 0n > 0n),
    id: id,
  };
}

function mapModifyReqToCoffee(
  id: string,
  data: InferOutput<typeof ModifyCoffeeReqSchema>
): Coffee {
  return {
    id: id,
    name: data.shopName,
    address: data.address,
    rating: data.rating,
    open_hours: data.openHours as OpenHour,
    lat: data.latLong[0],
    lng: data.latLong[1],
    created_at: new Date(),
    updated_at: new Date(),
    status: data.rating && data.rating !== 0 ? 'reviewed' : 'known',
  };
}
