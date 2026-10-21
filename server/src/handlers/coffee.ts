import { getDB, getMarknotesDB } from '../db';
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
  const db = await getDB();

  const coffee = await db
    .selectFrom('coffees')
    .where('coffees.id', '=', id)
    .selectAll()
    .executeTakeFirst();

  if (!coffee) {
    return { error: 'coffee shop not found' };
  }

  const bucketDB = await getMarknotesDB();
  const queryString = `%${coffee.name.trim().toLowerCase()}%`;

  const post = await (await fetch(`https://mwyndham.dev/api/articles-by-title.json?title=${coffee.name}`)).json() as {
    id: string;
    data: {
      title: string;
      description: string;
      pubDate: string;
      updatedDate: string;
      heroImage: {
        src: string;
        width: number;
        height: number;
        format: string;
      };
    };
    body: string;
    filePath: string;
    assetImports: string[];
    digest: string;
    deferredRender: boolean;
    collection: string;
  };


  return { post };
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
