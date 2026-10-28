import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type Env } from './env';
import { HandleAssets } from './handlers/assets';
import { linkApp } from './handlers/link';
import { coffeesApp } from './coffees';

const apiApp = new Hono<{ Bindings: Env }>()
  .route('/coffees', coffeesApp)
  .route('/link', linkApp);

const app = new Hono<{ Bindings: Env }>()
  .use(
    '*',
    cors({
      origin: [
        'http://localhost:5173',
        'https://dev-kopimap.mwyndham.dev',
        'https://kopimap.mwyndham.dev',
        'https://resource.mwyndham.dev',
      ],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    })
  )
  .route('/api', apiApp)
  .get('*', HandleAssets);

export default app;

export type AppType = typeof app;
