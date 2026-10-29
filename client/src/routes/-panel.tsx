import { useEffect, useRef, useState } from 'react';
import {
  RiArrowLeftSLine,
  RiFileCopyLine,
  RiRouteLine,
} from 'react-icons/ri';
import type { Coffee } from '@rpcTypes/coffee.ts';
import useSWR from 'swr';
import { type Sheet, useAppStore } from '@store/store.ts';
import { getTokens } from '@cookies/tokens.ts';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { AddKey, Browse, Search } from './-browse.tsx';
import { useKeyboardFit } from './-useKeyboardFit.ts';
import { CoffeeDetail } from './-coffeeDetail.tsx';
import { Editor } from './-coffeeEditor/-editor.tsx';
import { findExistingShop, readGoogleMapsLink } from './-googleMaps.ts';
import { area, directionsUrl, tilt, useDesktop, useWide } from './-util.ts';

const ORDER: Sheet[] = ['peek', 'half', 'full'];

// One panel for everything: a left column on desktop, a bottom sheet on mobile.
export function Panel() {
  const selected = useAppStore((state) => state.selectedCoffee);
  const editing = useAppStore((state) => state.editing);
  const placing = useAppStore((state) => state.placing);
  const sheet = useAppStore((state) => state.sheet);
  const setSheet = useAppStore((state) => state.setSheet);
  const stopEdit = useAppStore((state) => state.stopEdit);
  const { authenticated } = getTokens();
  const importShop = useAppStore((state) => state.importShop);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const { data: shops } = useSWR('coffees', rpcFetch(client.api.coffees.$get)({}));
  const [linkError, setLinkError] = useState('');
  const desktop = useDesktop();
  const wide = useWide();
  const railLength = useAppStore((state) => state.rail.length);
  // Phones: the rail is up on a shop or once there are stubs; a full sheet stops below it.
  const railUp = !placing && !editing && (!!selected || railLength > 0);
  const railGap = !railUp ? RAIL_GAP : railLength > 0 ? RAIL_GAP_STUBS : RAIL_GAP_BARE;
  // Below 1280px the receipt rolls into the till while a ticket hangs; a list key drops it again.
  const [dropped, setDropped] = useState(false);
  useEffect(() => setDropped(false), [selected?.id]);
  const rootRef = useRef<HTMLDivElement>(null);
  useKeyboardFit(rootRef, !desktop);
  // Each Add starts clean; the error belongs to the last link only.
  useEffect(() => {
    if (placing) setLinkError('');
  }, [placing]);

  const importLink = async (text: string) => {
    if (!text.trim()) return;
    const imported = await readGoogleMapsLink(text).catch(() => null);
    if (!imported) {
      // The peek sheet is too shallow for a second line.
      setSheet('half');
      return setLinkError('That link has no shop location.');
    }
    setLinkError('');
    const existing = shops && findExistingShop(shops, imported);
    if (existing) return setSelected(existing);
    importShop(imported.name, imported.latLng);
  };

  // The paper follows the finger on the handle, then settles at the nearest height.
  // A tap moves up a step, or back to half from full.
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; h: number; full: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const box = sheetRef.current!.getBoundingClientRect();
    // The bottom edge stays put, so full is the distance from it to the top margin.
    drag.current = { y: e.clientY, h: box.height, full: box.bottom - railGap };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || Math.abs(e.clientY - d.y) < 8) return;
    setDragHeight(Math.min(Math.max(d.h - (e.clientY - d.y), PEEK), d.full));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragHeight(null);
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) < 8) {
      const i = ORDER.indexOf(sheet);
      return setSheet(sheet === 'full' ? 'half' : ORDER[i + 1]);
    }
    const h = d.h - dy;
    const heights: [Sheet, number][] = [
      ['peek', PEEK],
      ['half', document.documentElement.clientHeight * 0.45],
      ['full', d.full],
    ];
    heights.sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h));
    setSheet(heights[0][0]);
  };

  // One row: the peek sheet is shallow, and the map below it must stay tappable.
  const placingSlip = (
    <div className="flex flex-col gap-2 px-4 py-3 lg:py-4">
      <div className="flex items-center gap-3">
        <input
          className="line flex-1"
          style={{ fontSize: 14 }}
          placeholder="Paste a link, or tap the map"
          aria-label="Paste a Google Maps link"
          onPaste={(e) => importLink(e.clipboardData.getData('text'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') importLink(e.currentTarget.value);
          }}
        />
        <button type="button" className="key key-sm" onClick={stopEdit}>
          Cancel
        </button>
      </div>
      {linkError && <p className="err">× {linkError}</p>}
    </div>
  );

  // Desktop: the till and receipt stay on the left, the open shop hangs on the right as a ticket.
  if (desktop) {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-4 left-4 z-[1000] flex w-[400px] flex-col font-atkinson">
          <Browse
            slip={placing ? placingSlip : undefined}
            rolled={editing || (!wide && !!selected && !dropped)}
            onListKey={() => setDropped(true)}
          />
        </div>
        <Rail ticket={editing || !!selected} />
        {(editing || selected) && (
          <div className="absolute top-7 right-4 bottom-4 z-[1001] flex w-[384px] flex-col font-atkinson">
            {editing ? (
              <Editor key={selected?.id ?? 'new'} coffee={selected ?? undefined} />
            ) : (
              selected && <CoffeeDetail key={selected.id} coffee={selected} />
            )}
          </div>
        )}
      </>
    );
  }

  const tillUp = !placing;
  // The paper rides on the till; with the till away (placing) it reaches the bottom edge.
  const bottom = tillUp ? `calc(${TILL}px + env(safe-area-inset-bottom))` : '0px';
  // Full fills the root above the till. While typing the root is only the visible area, above the keyboard.
  const height =
    dragHeight !== null
      ? `${dragHeight}px`
      : sheet === 'peek'
        ? `${PEEK}px`
        : sheet === 'half'
          ? '45dvh'
          : `calc(100% - ${bottom} - ${railGap}px)`;

  return (
    // One root for the phone layout; useKeyboardFit fits it to what the keyboard leaves visible.
    // The map shows through it, so only its children take taps.
    <div ref={rootRef} className="pointer-events-none fixed inset-x-0 top-0 z-[1000] h-dvh font-atkinson">
      {railUp && <MobileRail />}
      <section
        ref={sheetRef}
        className="pointer-events-auto absolute inset-x-2 z-[1] flex flex-col drop-shadow-[0_-6px_10px_rgb(0_0_0/.18)]"
        style={{ bottom, height }}
      >
        <div
          className={`tear-t flex min-h-0 flex-1 flex-col ${
            editing ? 'nota' : selected && !placing ? 'ticket' : 'receipt'
          }`}
        >
          <button
            type="button"
            className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center"
            aria-label="Resize panel"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
              setDragHeight(null);
            }}
          >
            <span className="h-[9px] w-[26px] bg-[linear-gradient(#141414,#141414)_0_0/100%_2px_no-repeat,linear-gradient(#141414,#141414)_0_50%/100%_2px_no-repeat,linear-gradient(#141414,#141414)_0_100%/100%_2px_no-repeat] opacity-70" />
          </button>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {placing ? (
              placingSlip
            ) : editing ? (
              <Editor key={selected?.id ?? 'new'} coffee={selected ?? undefined} />
            ) : selected ? (
              <CoffeeDetail key={selected.id} coffee={selected} />
            ) : (
              <Browse mobile />
            )}
          </div>
        </div>
      </section>
      {tillUp && (
        <MobileTill coffee={editing ? null : selected} editing={editing} authenticated={authenticated} />
      )}
    </div>
  );
}

const TILL = 68;
const PEEK = 64;
// Room left above a full sheet for the rail.
const RAIL_GAP = 16;
// The bare rail is 18px; with stubs hanging from it, 66px.
const RAIL_GAP_BARE = 26;
const RAIL_GAP_STUBS = 74;

// The till on the bottom edge. Its keys follow the paper on top: search on the receipt,
// Back, Directions, Copy and Review on a ticket.
function MobileTill({
  coffee,
  editing,
  authenticated,
}: {
  coffee: Coffee | null;
  editing: boolean;
  authenticated: boolean;
}) {
  const clearSelected = useAppStore((state) => state.removeSelectedCoffee);
  const { data: review } = useSWR(
    coffee && coffee.rating > 0 ? ['review', coffee.id] : null,
    coffee ? rpcFetch(client.api.coffees.review[':id'].$get)({ param: { id: coffee.id } }) : null
  );
  const [copied, setCopied] = useState(false);
  const post = review?.post;

  return (
    <div
      className="till pointer-events-auto absolute inset-x-0 bottom-0 z-[2] flex items-center gap-2 border-x-0 border-b-0 px-2.5 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] before:absolute before:inset-x-0 before:-top-[9px] before:h-[9px] before:bg-[#0A0A0A] before:shadow-[inset_0_-3px_3px_#000]"
    >
      {editing ? (
        // The editor portals its Cancel and Save keys here.
        <div id="till-slot" className="flex flex-1 gap-2" />
      ) : coffee ? (
        <>
          <button type="button" className="key min-h-12 w-12 shrink-0 px-0" onClick={clearSelected} aria-label="Back to the list">
            <RiArrowLeftSLine size={24} />
          </button>
          <a
            className={`key min-h-12 flex-1 ${post ? '' : 'key-signal'}`}
            target="_blank"
            href={directionsUrl(coffee)}
          >
            <RiRouteLine size={16} />
            Directions
          </a>
          {coffee.address && (
            <button
              type="button"
              className="key min-h-12 w-12 shrink-0 px-0"
              onClick={() => {
                navigator.clipboard.writeText(coffee.address);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              aria-label="Copy address"
            >
              {copied ? '✓' : <RiFileCopyLine size={18} />}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <Search />
          </div>
          {authenticated && <AddKey />}
        </>
      )}
      <SheetKey />
    </div>
  );
}

// Always on the till: steps the paper peek → half → full and back, with one lamp per height.
function SheetKey() {
  const sheet = useAppStore((state) => state.sheet);
  const setSheet = useAppStore((state) => state.setSheet);
  const level = ORDER.indexOf(sheet);
  return (
    <button
      type="button"
      className="key min-h-12 w-12 shrink-0 flex-col gap-[3px] px-0"
      onClick={() => setSheet(ORDER[(level + 1) % ORDER.length])}
      aria-label={`Sheet height: ${sheet}. Change it`}
    >
      {[2, 1, 0].map((n) => (
        <i
          key={n}
          className={`h-[3px] w-4 ${n <= level ? 'bg-[var(--signal)] shadow-[0_0_5px_rgb(255_90_31/.8)]' : 'bg-[#404040]'}`}
        />
      ))}
    </button>
  );
}

// On a phone the rail runs along the top edge, with room for two stubs.
function MobileRail() {
  const rail = useAppStore((state) => state.rail);
  const selected = useAppStore((state) => state.selectedCoffee);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const takeDown = useAppStore((state) => state.takeDown);
  if (!selected && rail.length === 0) return null;
  return (
    <>
      <div className="steel absolute inset-x-0 top-0 h-[18px] border-x-0 border-t-0" />
      <ul className="pointer-events-auto absolute top-3.5 right-2 left-2 flex flex-row-reverse gap-2 overflow-hidden pt-2">
        {rail.slice(0, 2).map((c) => (
          <li key={c.id} className="ticket stub-m relative flex h-11 w-[170px] shrink-0">
            <span className="hold" />
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer pt-3 pl-2.5 text-left"
              onClick={() => setSelected(c)}
              title={`Open ${c.name}`}
            >
              <span className="block truncate font-display text-[16px] leading-none font-extrabold uppercase">
                {c.name}
              </span>
            </button>
            <button
              type="button"
              className="grid w-11 shrink-0 cursor-pointer place-items-center pt-1.5 font-mono text-[17px] font-bold"
              onClick={() => takeDown(c.id)}
              aria-label={`Take ${c.name} down`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// The steel rail along the top, and the stubs of shops opened before the open one.
function Rail({ ticket }: { ticket: boolean }) {
  const rail = useAppStore((state) => state.rail);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const takeDown = useAppStore((state) => state.takeDown);
  const setStubHover = useAppStore((state) => state.setStubHover);
  if (!ticket && rail.length === 0) return null;
  return (
    <>
      <div className="steel absolute top-3 right-4 left-[432px] z-[999] h-6" />
      <ul
        className={`absolute top-7 left-[444px] z-[1000] flex flex-row-reverse gap-2 overflow-hidden pt-2 font-atkinson ${
          ticket ? 'right-[408px]' : 'right-4'
        }`}
      >
        {rail.map((c) => (
          <li
            key={c.id}
            className="group relative shrink-0"
            onMouseEnter={() => setStubHover(c.id)}
            onMouseLeave={() => setStubHover(null)}
          >
            <button
              type="button"
              data-stub={c.id}
              className="ticket stub h-24 w-[168px] cursor-pointer px-3 pt-[15px] pb-2.5 text-left"
              onClick={() => setSelected(c)}
              title={`Open ${c.name}`}
            >
              <span className="hold" />
              <span className="line-clamp-2 pr-5 font-display text-[19px] leading-none font-extrabold uppercase">
                {c.name}
              </span>
              <span className="mt-2 flex items-center gap-1.5 font-mono text-[13px]">
                {c.status === 'reviewed' ? (
                  <span className="stamp" style={tilt(c.id)}>
                    Reviewed {c.rating.toFixed(1)}
                  </span>
                ) : c.status === 'closed' ? (
                  <span className="stamp stamp-ink" style={tilt(c.id)}>
                    Closed
                  </span>
                ) : c.rating > 0 ? (
                  <b className="inline-flex items-center gap-0.5">
                    <i className="cup" />
                    {c.rating.toFixed(1)}
                  </b>
                ) : null}
                {c.address && <span className="truncate">{area(c.address)}</span>}
              </span>
            </button>
            <button
              type="button"
              className="absolute top-3 right-1 z-[3] grid size-6 cursor-pointer place-items-center border-[1.5px] border-base-content bg-[#F6F6F6] font-mono text-[15px] font-bold opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => {
                takeDown(c.id);
                setStubHover(null);
              }}
              title="Take down"
              aria-label={`Take ${c.name} down`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
