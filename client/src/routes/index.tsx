import { createFileRoute } from '@tanstack/react-router';
import { SearchBar } from './-searchBar.tsx';
import { MapLayers } from './-mapLayers.tsx';
import { useAppStore } from '@store/store.ts';
import { CoffeeDetail } from './-coffeeDetail.tsx';
import { ContentTab } from './-contentTab.tsx';
import { getTokens } from '@cookies/tokens.ts';
import { RiAddLine } from 'react-icons/ri';
import { useEffect } from 'react';
import { client, rpcFetch } from '@fetcher/fetcher.ts';

export const Route = createFileRoute('/')({
  component: Index,
  // ?shop=<id> opens that shop, for links from mwyndham.dev.
  validateSearch: (search: Record<string, unknown>): { shop?: string } => ({
    shop: typeof search.shop === 'string' ? search.shop : undefined,
  }),
});

function Index() {
  const selectedCoffee = useAppStore((state) => state.selectedCoffee);
  const collapse = useAppStore((state) => state.collapsed);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const { shop } = Route.useSearch();

  useEffect(() => {
    if (!shop) return;
    rpcFetch(client.api.coffees[':id'].$get)({ param: { id: shop } })().then(
      ({ coffee }) => coffee && setSelected(coffee)
    );
  }, [shop, setSelected]);

  const { authenticated } = getTokens();

  return (
    <div className="h-full w-full">
      <MapLayers />
      <div
        className={`absolute top-0 w-full px-2 pt-6 z-[1000] lg:left-[3vh] lg:w-1/4 lg:px-0 ${
          selectedCoffee ? 'hidden lg:block' : ''
        }`}
      >
        <SearchBar />
      </div>
      <div
        className={`absolute bottom-0 lg:top-20 w-full z-[1000] rounded-b-none lg:rounded-b-box lg:left-[3vh] lg:max-h-[88vh] lg:w-1/4 ${
          selectedCoffee ? 'hidden lg:block' : ''
        }`}
      >
        <div
          className={`drop-shadow-2xl card bg-base-100 ${
            collapse ? 'h-[8vh] -translate-y-[20px]' : 'h-[55vh]'
          } lg:max-h-[88vh]`}
          style={{
            transition:
              'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform, height',
            transform: collapse ? `translateY(20px)` : 'translateY(0)',
            pointerEvents: 'auto',
          }}
        >
          <ContentTab />
        </div>
      </div>
      {selectedCoffee && (
        <div className="absolute bottom-0 h-fit max-h-screen w-full z-[1000] lg:w-[30%] lg:right-[3%] lg:top-0 lg:my-6">
          <CoffeeDetail coffee={selectedCoffee} />
        </div>
      )}
      {authenticated && (
        <a
          className={`absolute left-0 m-6 h-12 w-12 p-2 btn rounded-3xl ${
            collapse ? 'bottom-[8vh] -translate-y-[20px]' : 'bottom-[55vh]'
          } btn-primary z-1001 drop-shadow-2xl lg:bottom-0`}
          href={`/add`}
          style={{
            transition:
              'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform, height',
            transform: collapse ? `translateY(20px)` : 'translateY(0)',
            pointerEvents: 'auto',
          }}
        >
          <RiAddLine className={`w-full h-full`} />
        </a>
      )}
    </div>
  );
}

export default Index;
