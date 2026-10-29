import { type Context } from 'hono';
import { getDB } from '../db';
import { type InferOutput } from 'valibot';
import { ImageOrderSchema, ImageUploadSchema } from '@rpcTypes/image';
import { sql } from 'kysely';
import { Resource } from 'sst';
import { uuidv7 } from 'uuidv7';

export async function deleteImage(id: string) {
  const db = await getDB();

  const deleted = await db
    .deleteFrom('images')
    .where('images.id', '=', id)
    .executeTakeFirst();

  return { success: deleted.numDeletedRows === 1n };
}

export async function image(c: Context) {
  const db = await getDB();
  const id = c.req.param('id');

  const image = await db
    .selectFrom('images')
    .selectAll()
    .where('images.coffee_id', '=', id)
    .orderBy('images.position')
    .orderBy('images.id')
    .execute();

  return c.json(image);
}

export async function reorderImages(order: InferOutput<typeof ImageOrderSchema>) {
  const db = await getDB();
  for (const [position, id] of order.ids.entries()) {
    await db
      .updateTable('images')
      .set({ position })
      .where('images.id', '=', id)
      .where('images.coffee_id', '=', order.coffeeId)
      .execute();
  }
  return { success: true };
}

export async function createImage(
  image: InferOutput<typeof ImageUploadSchema>
) {
  const imageId = uuidv7();
  const key = `images/${imageId}-${image.file.name}`;
  // The key holds a new id on every upload, so the photo at this URL never changes.
  await Resource.PetaKopiBucket.put(key, image.file, {
    httpMetadata: { cacheControl: 'public, max-age=31536000, immutable' },
  });

  const db = await getDB();
  const res = await db
    .insertInto('images')
    .values({
      url: `https://${process.env.BUCKET_DOMAIN}/${key}`,
      alt: 'image alt',
      id: imageId,
      coffee_id: image.id,
      // Append after existing photos so an upload never replaces the thumbnail.
      position: sql<number>`(select coalesce(max(position), -1) + 1 from images where coffee_id = ${image.id})`,
    })
    .executeTakeFirst();

  return {
    success: !!(res.numInsertedOrUpdatedRows ?? 0n > 0n),
    id: imageId,
  };
}
