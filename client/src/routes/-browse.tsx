import useSWR from 'swr';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { useAppStore } from '@store/store.ts';
import { getTokens } from '@cookies/tokens.ts';
import { RiAddLine, RiSearchLine } from 'react-icons/ri';
import { CoffeeListItem } from './-contentTab/-common/-cofeeListItem.tsx';
import { at, distance } from './-util.ts';

// The till always; under it the receipt, or the slip that replaces it while adding.
// Rolled: the receipt is back in the till, so the map is free while editing.
export function Browse({
  slip,
  rolled = false,
  mobile = false,
}: { slip?: ReactNode; rolled?: boolean; mobile?: boolean } = {}) {
  const tab = useAppStore((state) => state.tab);
  const setTab = useAppStore((state) => state.setTab);
  const query = useAppStore((state) => state.query);
  const setQuery = useAppStore((state) => state.setQuery);
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

  const tabKey = (id: typeof tab, label: string, hint: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      className="key flex-1"
      onClick={() => setTab(id)}
      title={`${label} (${hint})`}
    >
      <span className="led" />
      {label}
    </button>
  );

  const tabs = !q && (
    <>
      {tabKey('latestReviews', 'Latest reviews', '1')}
      {tabKey('allPlaces', 'All places', '2')}
    </>
  );

  const total = (
    <p className="mx-3 border-b-2 border-dashed border-base-content/40 py-2.5 text-center font-mono text-[13px]">
      {all ? `${all.length} shops · ${reviewedCount} reviewed` : 'Loading shops…'}
      {!authenticated && (
        <>
          {' · '}
          <a href="/authorize" className="font-bold text-accent underline">
            Sign in
          </a>
        </>
      )}
    </p>
  );

  const rows = (
    <div className="min-h-0 flex-1 overflow-y-auto px-3">
      {q && list.length === 0 && (
        <p className="p-6 text-center text-[15px]">No shop matches “{query.trim()}”.</p>
      )}
      <ul ref={listRef} className="flex flex-col">
        {list.map((c, i) => (
          <CoffeeListItem key={c.id} coffee={c} highlighted={i === highlight} />
        ))}
      </ul>
    </div>
  );

  // Phone: search lives on the till at the bottom edge, so the paper holds only the list.
  if (mobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {total}
        {tabs && (
          <div role="tablist" className="flex gap-2 px-3 pt-3 pb-1.5">
            {tabs}
          </div>
        )}
        {rows}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col lg:pointer-events-auto lg:flex-none"
      onKeyDown={onKeyDown}
    >
      <div className="till shrink-0 px-3 pt-3">
        <Search />
        <div role="tablist" className="mt-2.5 flex gap-2">
          {tabs}
          {authenticated && <AddKey />}
        </div>
        <div className="-mx-3 mt-3 h-2 bg-[#0A0A0A] shadow-[inset_0_3px_3px_#000]" />
      </div>
      {slip ? (
        <div className="receipt tear-b mx-2 pb-3">{slip}</div>
      ) : rolled ? null : (
        <div className="receipt tear-b mx-2 flex min-h-0 flex-1 flex-col pb-4 lg:flex-none">
          {total}
          {rows}
        </div>
      )}
    </div>
  );
}

// The VFD. Focusing it feeds the paper all the way up, so results show above a phone keyboard.
export function Search() {
  const query = useAppStore((state) => state.query);
  const setQuery = useAppStore((state) => state.setQuery);
  const setSheet = useAppStore((state) => state.setSheet);
  return (
    <label className="vfd">
      <RiSearchLine size={20} className="shrink-0" />
      <input
        id="search-bar"
        type="search"
        placeholder="Search shops"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setSheet('full')}
      />
    </label>
  );
}

export function AddKey() {
  const startAdd = useAppStore((state) => state.startAdd);
  return (
    <button
      type="button"
      className="key key-cobalt ml-auto w-10 shrink-0 px-0"
      onClick={startAdd}
      title="Add a shop"
      aria-label="Add a shop"
    >
      <RiAddLine size={22} />
    </button>
  );
}
