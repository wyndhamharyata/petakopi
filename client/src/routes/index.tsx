import { createFileRoute } from '@tanstack/react-router';
import { MapLayers } from './-mapLayers.tsx';
import { Panel } from './-panel.tsx';
import { Shortcuts } from './-shortcuts.tsx';
import { useAppStore } from '@store/store.ts';
import { getTokens } from '@cookies/tokens.ts';
import { useEffect } from 'react';
import { client, rpcFetch } from '@fetcher/fetcher.ts';

export const Route = createFileRoute('/')({
  component: Index,
  // ?shop=<id> opens that shop, for links from mwyndham.dev; &edit=1 opens it in edit mode.
  // ?add=1 starts adding a shop. The old /<id>/edit and /add pages redirect here.
  validateSearch: (
    search: Record<string, unknown>
  ): { shop?: string; edit?: number; add?: number } => ({
    shop: typeof search.shop === 'string' ? search.shop : undefined,
    edit: search.edit ? 1 : undefined,
    add: search.add ? 1 : undefined,
  }),
});

function Index() {
  const { shop, edit, add } = Route.useSearch();

  useEffect(() => {
    const { authenticated } = getTokens();
    const state = useAppStore.getState();
    if (add && authenticated) return state.startAdd();
    if (!shop) return;
    rpcFetch(client.api.coffees[':id'].$get)({ param: { id: shop } })().then(({ coffee }) => {
      if (!coffee) return;
      useAppStore.getState().setSelectedCoffee(coffee);
      if (edit && authenticated) useAppStore.getState().startEdit();
    });
  }, [shop, edit, add]);

  return (
    <div className="h-full w-full">
      <MapLayers />
      <Panel />
      <Shortcuts />
    </div>
  );
}

export default Index;
