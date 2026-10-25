import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie } from 'hono/cookie';
import { authClient, subjects } from '@auth/auth';
import { Resource } from 'sst';

export const authMiddleware = createMiddleware(async (c, next) => {
  const accessToken = getCookie(c, 'access_token')?.trim();
  const refreshToken = getCookie(c, 'refresh_token')?.trim();

  const cl = authClient(Resource.IssuerUrl.value);
  const verified = await cl.verify(subjects, accessToken ?? '', {
    refresh: refreshToken ?? '',
  });
  if (verified.err) {
    return c.redirect('/authorize');
  }

  // A verified token proves who the user is, not that they may edit the map.
  const { oauthID, email } = verified.subject.properties;
  if (oauthID !== '34619560' || email !== 'mwyndham.business@gmail.com') {
    return c.json({ error: 'Only the map owner can change shops' }, 403);
  }

  c.set('user', verified.subject);

  if (verified.tokens?.access && accessToken !== verified.tokens?.access) {
    setCookie(c, 'access_token', verified.tokens?.access ?? '');
    setCookie(c, 'refresh_token', verified.tokens?.refresh ?? '');
  }

  await next();
});
