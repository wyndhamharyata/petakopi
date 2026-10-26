import useSWR from 'swr';
import { useEffect, useMemo, useRef, useState } from 'react';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { useAppStore } from '@store/store.ts';
import { getTokens } from '@cookies/tokens.ts';
import { RiSearchLine } from 'react-icons/ri';
import { CoffeeListItem } from './-contentTab/-common/-cofeeListItem.tsx';
import { at, distance } from './-util.ts';

export function Browse() {
  const tab = useAppStore((state) => state.tab);
  const setTab = useAppStore((state) => state.setTab);
  const query = useAppStore((state) => state.query);
  const setQuery = useAppStore((state) => state.setQuery);
  const setSheet = useAppStore((state) => state.setSheet);
  const setBrowseList = useAppStore((state) => state.setBrowseList);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const userLocation = useAppStore((state) => state.userLocation);
  const { authenticated } = getTokens();

  const { data: all } = useSWR('coffees', rpcFetch(client.api.coffees.$get)({}));
  const { data: latest } = useSWR(
    'latestReviews',
    rpcFetch(client.api.coffees.latestReviews.$get)({})
  );

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    // Search is local: the map already loaded every shop.
    if (q) {
      return (all ?? []).filter(
        (c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
      );
    }
    if (tab === 'latestReviews') return latest ?? [];
    const places = [...(all ?? [])];
    return userLocation
      ? places.sort((a, b) => distance(userLocation, at(a)) - distance(userLocation, at(b)))
      : places.sort((a, b) => a.name.localeCompare(b.name));
  }, [q, tab, all, latest, userLocation]);

  useEffect(() => setBrowseList(list), [list, setBrowseList]);

  const [highlight, setHighlight] = useState(-1);
  useEffect(() => setHighlight(-1), [list]);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  // ↑ ↓ Enter while the search field or the list has focus; the map keeps its own arrow keys.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => Math.min(list.length - 1, Math.max(0, h + step)));
    } else if (e.key === 'Enter' && list[highlight]) {
      e.preventDefault();
      setSelected(list[highlight]);
    } else if (e.key === 'Escape' && query) {
      e.stopPropagation();
      setQuery('');
    }
  };

  const reviewedCount = all?.filter((c) => c.status === 'reviewed').length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="flex flex-col gap-3 p-4 pb-2">
        <label className="input w-full">
          <RiSearchLine className="opacity-60" />
          <input
            id="search-bar"
            type="search"
            className="grow"
            placeholder="Search coffee shops"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => useAppStore.getState().sheet === 'peek' && setSheet('half')}
          />
          <kbd className="kbd kbd-sm max-lg:hidden">⌘K</kbd>
        </label>
        {!q && (
          <div role="tablist" className="tabs tabs-border">
            <button
              role="tab"
              className={`tab ${tab === 'latestReviews' ? 'tab-active' : ''}`}
              onClick={() => setTab('latestReviews')}
              title="Latest reviews (1)"
            >
              Latest reviews
            </button>
            <button
              role="tab"
              className={`tab ${tab === 'allPlaces' ? 'tab-active' : ''}`}
              onClick={() => setTab('allPlaces')}
              title="All places (2)"
            >
              All places
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {q && list.length === 0 && (
          <p className="p-6 text-center text-[15px] text-base-content/60">
            No shop matches “{query.trim()}”.
          </p>
        )}
        <ul ref={listRef} className="flex flex-col">
          {list.map((c, i) => (
            <CoffeeListItem key={c.id} coffee={c} highlighted={i === highlight} />
          ))}
        </ul>
      </div>
      <div className="border-t border-base-300 px-4 py-3 text-center text-[13px] text-base-content/60">
        {all ? `${all.length} shops · ${reviewedCount} reviewed` : 'Loading shops…'}
        {!authenticated && (
          <>
            {' · '}
            <a href="/authorize" className="link link-accent">
              Sign in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
