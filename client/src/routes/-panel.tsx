import { useEffect, useRef, useState } from 'react';
import {
  RiArrowLeftSLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiRouteLine,
} from 'react-icons/ri';
import type { Coffee } from '@rpcTypes/coffee.ts';
import useSWR from 'swr';
import { type Sheet, useAppStore } from '@store/store.ts';
import { getTokens } from '@cookies/tokens.ts';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { AddKey, Browse, Search } from './-browse.tsx';
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
  // Below 1280px the receipt rolls into the till while a ticket hangs; a list key drops it again.
  const [dropped, setDropped] = useState(false);
  useEffect(() => setDropped(false), [selected?.id]);
  const keyboard = useKeyboardInset();
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
    drag.current = { y: e.clientY, h: box.height, full: box.bottom - RAIL_GAP };
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
  const bottom = tillUp ? `calc(${TILL}px + env(safe-area-inset-bottom) + ${keyboard.inset}px)` : '0px';
  // Full fills what is visible above the till; the keyboard is already out of the visible height.
  const height =
    dragHeight !== null
      ? `${dragHeight}px`
      : sheet === 'peek'
        ? `${PEEK}px`
        : sheet === 'half'
          ? '45dvh'
          : `calc(${keyboard.height}px - ${tillUp ? `${TILL}px - env(safe-area-inset-bottom)` : '0px'} - ${RAIL_GAP}px)`;

  return (
    <>
      {tillUp && !editing && <MobileRail />}
      <section
        ref={sheetRef}
        className="fixed inset-x-2 z-[1000] flex flex-col font-atkinson drop-shadow-[0_-6px_10px_rgb(0_0_0/.18)]"
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
        <MobileTill
          coffee={editing ? null : selected}
          editing={editing}
          bottom={keyboard.inset}
          authenticated={authenticated}
        />
      )}
    </>
  );
}

const TILL = 68;
const PEEK = 64;
// Room left above a full sheet for the rail.
const RAIL_GAP = 44;

// The keyboard covers the layout viewport on iOS; the visual viewport says how much.
function useKeyboardInset() {
  const read = () => {
    const vv = window.visualViewport;
    return vv
      ? // clientHeight is the layout viewport; iOS also shrinks innerHeight, which hid the keyboard's size.
        { inset: Math.max(0, document.documentElement.clientHeight - vv.height - vv.offsetTop), height: vv.height }
      : { inset: 0, height: innerHeight };
  };
  const [state, setState] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onChange = () => setState(read());
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
    };
  }, []);
  return state;
}

// The till on the bottom edge. Its keys follow the paper on top: search on the receipt,
// Back, Directions, Copy and Review on a ticket.
function MobileTill({
  coffee,
  editing,
  bottom,
  authenticated,
}: {
  coffee: Coffee | null;
  editing: boolean;
  bottom: number;
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
      className="till fixed inset-x-0 z-[1001] flex items-center gap-2 border-x-0 border-b-0 px-2.5 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] before:absolute before:inset-x-0 before:-top-[9px] before:h-[9px] before:bg-[#0A0A0A] before:shadow-[inset_0_-3px_3px_#000]"
      style={{ bottom }}
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
          {post && (
            <a className="key key-signal min-h-12 flex-1" target="_blank" href={post.url}>
              Review
              <RiExternalLinkLine size={16} />
            </a>
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
    </div>
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
      <div className="steel fixed inset-x-0 top-0 z-[999] h-[18px] border-x-0 border-t-0" />
      <ul className="fixed top-3.5 right-2 left-2 z-[1000] flex flex-row-reverse gap-2 overflow-hidden pt-2 font-atkinson">
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
