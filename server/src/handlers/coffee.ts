import { getDB } from '../db';
import { sql } from 'kysely';
import { Resource } from 'sst';
import { type Coffee, ModifyCoffeeReqSchema } from '@rpcTypes/coffee';
import { uuidv7 } from 'uuidv7';
import { type InferOutput } from 'valibot';
import { type OpenHour } from '@rpcTypes/openHour';

interface Review {
  coffeeId: string;
  slug: string;
  title: string;
  rating: number;
  pubDate: string;
  url: string;
}

// mwyndham.dev's published reviews decide which shops are reviewed, and their rating.
// `minAge` lets a refresh skip the fetch when the copy is only seconds old.
async function reviewIndex(minAge = 600_000): Promise<Review[] | null> {
  const cached = await Resource.PetaKopiKV.get<{ fetchedAt: number; reviews: Review[] }>(
    'REVIEW_INDEX',
    'json'
  );
  if (cached && Date.now() - cached.fetchedAt < minAge) return cached.reviews;

  const resp = await fetch('https://mwyndham.dev/api/coffee-reviews.json').catch(() => null);
  if (!resp?.ok) return cached?.reviews ?? null;

  const reviews = (await resp.json()) as Review[];
  await Resource.PetaKopiKV.put('REVIEW_INDEX', JSON.stringify({ fetchedAt: Date.now(), reviews }));
  return reviews;
}

// Without an index (blog down, empty KV) the stored status and rating stay as the fallback.
function withReview(coffee: Coffee, reviews: Review[] | null) {
  if (!reviews) return { ...coffee, review: null };
  const review = reviews.find((r) => r.coffeeId === coffee.id) ?? null;
  return {
    ...coffee,
    status: coffee.status === 'closed' ? 'closed' : review ? 'reviewed' : 'known',
    rating: review?.rating ?? 0,
    review,
  } as const;
}

export async function refreshReviews() {
  await reviewIndex(30_000);
  return { ok: true };
}

export async function coffeeById(id: string) {
  const db = await getDB();
  const [coffee, reviews] = await Promise.all([
    db.selectFrom('coffees').where('coffees.id', '=', id).selectAll().executeTakeFirst(),
    reviewIndex(),
  ]);

  return { coffee: coffee && withReview(coffee, reviews) };
}

export async function coffees() {
  const db = await getDB();
  const [rows, reviews] = await Promise.all([
    db.selectFrom('coffees').selectAll().execute(),
    reviewIndex(),
  ]);
  return rows.map((coffee) => withReview(coffee, reviews));
}

export async function latestReviews() {
  const db = await getDB();
  const [rows, reviews, comments] = await Promise.all([
    db.selectFrom('coffees').selectAll().execute(),
    reviewIndex(),
    fetch('https://mwyndham.dev/api/coffee-reviews/comments.json')
      .then((r) => (r.ok ? r.json() : {}) as Promise<Record<string, { count: number }>>)
      .catch(() => ({}) as Record<string, { count: number }>),
  ]);

  const reviewed = reviews
    ? [...reviews]
        .sort((a, b) => b.pubDate.localeCompare(a.pubDate))
        .flatMap((r) => rows.filter((coffee) => coffee.id === r.coffeeId))
    : rows
        .filter((coffee) => coffee.status === 'reviewed')
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));

  return reviewed.map((coffee) => ({
    ...withReview(coffee, reviews),
    commentCount: comments[coffee.id]?.count ?? 0,
  }));
}

export async function search(queryParam: string | undefined) {
  const db = await getDB();
  const queryString = `%${queryParam?.trim() ?? ''}%`;

  const [coffees, reviews] = await Promise.all([
    db
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
      .execute(),
    reviewIndex(),
  ]);

  return coffees.map((coffee) => withReview(coffee, reviews));
}

export async function review(id: string) {
  // marknotes prerenders the first two for each article whose frontmatter sets `coffeeId`.
  const [meta, embed, comments] = await Promise.all([
    fetch(`https://mwyndham.dev/api/coffee-reviews/${encodeURIComponent(id)}.json`),
    fetch(`https://mwyndham.dev/embed/coffee/${encodeURIComponent(id)}`),
    fetch('https://mwyndham.dev/api/coffee-reviews/comments.json').catch(() => null),
  ]);
  if (!meta.ok || !embed.ok) return { post: null, comments: null };

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
  const byCoffee = comments?.ok
    ? ((await comments.json()) as Record<
        string,
        {
          count: number;
          latest: { id: number; alias: string; message: string; createdAt: string; parentId: number | null }[];
        }
      >)
    : {};
  return { post: { ...post, html }, comments: byCoffee[id] ?? { count: 0, latest: [] } };
}

export async function editCoffeeShop(
  data: InferOutput<typeof ModifyCoffeeReqSchema>,
  id: string
) {
  const db = await getDB();

  // Only the shop facts: the rating and "reviewed" belong to the review on mwyndham.dev,
  // and `created_at` must survive edits.
  const result = await db
    .updateTable('coffees')
    .set({
      name: data.shopName,
      address: data.address,
      open_hours: data.openHours as OpenHour,
      lat: data.latLong[0],
      lng: data.latLong[1],
      status: data.closed ? 'closed' : 'known',
      updated_at: new Date(),
    })
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
    .values({
      id: id,
      name: data.shopName,
      address: data.address,
      rating: 0,
      open_hours: data.openHours as OpenHour,
      lat: data.latLong[0],
      lng: data.latLong[1],
      created_at: new Date(),
      updated_at: new Date(),
      status: data.closed ? 'closed' : 'known',
    })
    .executeTakeFirst();

  return {
    success: !!(result.numInsertedOrUpdatedRows ?? 0n > 0n),
    id: id,
  };
}
