import { Hono } from 'hono';
import type { Env } from './env';
import { createImage, deleteImage, image, reorderImages } from './handlers/images';
import {
  coffeeById,
  coffees,
  createCoffeeShop,
  editCoffeeShop,
  latestReviews,
  refreshReviews,
  review,
  search,
} from './handlers/coffee';
import { authMiddleware } from './middlewares/auth';
import { vValidator } from '@hono/valibot-validator';
import { ModifyCoffeeReqSchema } from '@rpcTypes/coffee';
import { ImageOrderSchema, ImageUploadSchema } from '@rpcTypes/image';

export const coffeesApp = new Hono<{ Bindings: Env }>()
  // Return Images of a Coffee Shop
  .get('/images/:id', image)

  // Delete existing image
  .delete('/images/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');

    return c.json(await deleteImage(id));
  })

  // Reread mwyndham.dev's review index now; marknotes calls this after a deploy
  .post('/reviews/refresh', async (c) => {
    return c.json(await refreshReviews());
  })

  // Search and Return Review for A Coffee Shop
  .get('/review/:id', async (c) => {
    const id = c.req.param('id');
    return c.json(await review(id));
  })

  // Search For Coffee Shop by Matching Name and Address
  .get('/search', async (c) => {
    const q = c.req.query('q');
    return c.json(await search(q));
  })

  // Get Latest Coffee Shop Review
  .get('/latestReviews', async (c) => {
    return c.json(await latestReviews());
  })

  // Get Coffee Shop by Id
  .get('/:id', async (c) => {
    const id = c.req.param('id');
    return c.json(await coffeeById(id));
  })

  // Get All Coffee Shops
  .get('/', async (c) => {
    return c.json(await coffees());
  })

  // Update Coffee Shop
  .post(
    '/:id/update',
    authMiddleware,
    vValidator('json', ModifyCoffeeReqSchema),
    async (c) => {
      const data = c.req.valid('json');
      const id = c.req.param('id');
      return c.json(await editCoffeeShop(data, id));
    }
  )

  // Create Coffee Shop
  .post(
    '/',
    authMiddleware,
    vValidator('json', ModifyCoffeeReqSchema),
    async (c) => {
      const data = c.req.valid('json');
      return c.json(await createCoffeeShop(data));
    }
  )

  // Images
  .put(
    'images',
    authMiddleware,
    vValidator('form', ImageUploadSchema),
    async (c) => {
      const data = c.req.valid('form');
      return c.json(await createImage(data));
    }
  )
  .post(
    'images/order',
    authMiddleware,
    vValidator('json', ImageOrderSchema),
    async (c) => c.json(await reorderImages(c.req.valid('json')))
  );
