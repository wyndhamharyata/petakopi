import { createFileRoute, redirect } from '@tanstack/react-router';

// Adding happens on the map now; keep old links working.
export const Route = createFileRoute('/add/')({
  beforeLoad: () => {
    throw redirect({ to: '/', search: { add: 1 } });
  },
});
