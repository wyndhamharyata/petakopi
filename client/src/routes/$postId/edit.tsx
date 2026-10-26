import { createFileRoute, redirect } from '@tanstack/react-router';

// Editing happens in the shop panel now; keep old links working.
export const Route = createFileRoute('/$postId/edit')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/', search: { shop: params.postId, edit: 1 } });
  },
});
