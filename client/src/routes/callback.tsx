import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { authClient, subjects } from '@auth/auth.ts';
import { object, parse, string } from 'valibot';
import type { Challenge } from '@openauthjs/openauth/client';
import type { InvalidAuthorizationCodeError } from '@openauthjs/openauth/error';
import { setTokens } from '@cookies/tokens.ts';

const CallbackSchema = object({
  code: string(),
});
export const Route = createFileRoute('/callback')({
  component: RouteComponent,
  validateSearch: (v) => {
    return parse(CallbackSchema, v);
  },
});

function RouteComponent() {
  const { code } = Route.useSearch();

  const [error, setError] = useState<
    InvalidAuthorizationCodeError | undefined
  >();

  const cl = authClient(import.meta.env.VITE_ISSUER_URL);

  useEffect(() => {
    const redirect = async () => {
      const challenge = JSON.parse(
        sessionStorage.getItem('challenge-key') ?? ''
      ) as Challenge;

      const exchanged = await cl.exchange(
        code,
        `${import.meta.env.VITE_CLIENT_URL}/callback`,
        challenge?.verifier
      );
      if (exchanged.err) {
        setError(exchanged.err);
        return;
      }

      const verified = await cl.verify(subjects, exchanged.tokens.access, {
        refresh: exchanged.tokens.refresh,
      });
      if (verified.err) {
        setError(verified.err);
        return;
      }

      if (verified?.subject?.type != 'user') {
        setError(new Error('Subject type is not recognized'));
        return;
      }

      if (verified?.subject?.properties?.userID !== '1') {
        setError(new Error('User info is not registered'));
        return;
      }

      await setTokens(exchanged.tokens.access, exchanged.tokens.refresh);
      window.location.href = '/';
    };

    redirect().then((r) => console.log(r));
  }, []);

  return (
    <div className="flex h-full w-full">
      {error !== undefined ? (
        <p className="m-auto">
          {' '}
          {`Your identity cannot be validated: ${error}`}{' '}
        </p>
      ) : (
        <p className="m-auto">Checking your identity...</p>
      )}
    </div>
  );
}
