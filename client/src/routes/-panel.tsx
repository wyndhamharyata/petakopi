import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { type Sheet, useAppStore } from '@store/store.ts';
import { getTokens } from '@cookies/tokens.ts';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { AddKey, Browse, Search } from './-browse.tsx';
import { useKeyboardFit } from './-useKeyboardFit.ts';
import { CoffeeDetail } from './-coffeeDetail.tsx';
import { Editor } from './-coffeeEditor/-editor.tsx';
import { findExistingShop, readGoogleMapsLink } from './-googleMaps.ts';
import { area, tilt, useDesktop, useWide } from './-util.ts';

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
  const rootRef = useRef<HTMLDivElement>(null);
  useKeyboardFit(rootRef, !desktop);
  // On the list the till is the top of the sheet; editing puts it on the bottom edge for
  // Cancel and Save; an open shop carries its own keys.
  const listView = !placing && !editing && !selected;
  const tillUp = editing && !placing;
  // The paper rests on the till, whose height depends on the safe area; measured, not assumed.
  const tillRef = useRef<HTMLDivElement>(null);
  const [tillHeight, setTillHeight] = useState(0);
  useLayoutEffect(() => {
    const till = tillRef.current;
    if (!till) return;
    const observer = new ResizeObserver(() => setTillHeight(till.offsetHeight));
    observer.observe(till);
    return () => observer.disconnect();
  }, [desktop, tillUp, listView]);
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

  const sheetRef = useRef<HTMLElement>(null);
  // Set by a drag, so the click that may follow it does not also step the height.
  const dragged = useRef(false);
  // A tap on the handle moves up a step, or back to half from full.
  const stepSheet = () => {
    if (dragged.current) return;
    setSheet(sheet === 'full' ? 'half' : ORDER[ORDER.indexOf(sheet) + 1]);
  };

  // Ported from reader-hero's bottom sheet: native listeners, as React's touchmove is passive.
  // The first move decides: the paper follows the finger, or the list scrolls.
  // The sheet is always full height and slides with a transform, which the GPU moves without
  // laying out or repainting anything. Only the paper inside it is cut to the visible height,
  // so the list scrolls to its end; that cut changes once the sheet stops, not per frame.
  const bottomPx = tillUp ? tillHeight + SLOT : 0;
  // On the list, peek is the till strip alone.
  // shortcut: ignores the bottom safe area, which is 0 while a browser toolbar is showing; add it if this ever runs standalone.
  const peekPx = listView && tillHeight ? tillHeight : PEEK;
  const heightOf = (s: Sheet) => (s === 'peek' ? `${peekPx}px` : s === 'half' ? '45dvh' : '100%');
  // A percentage in translateY is of the sheet itself, so this hides all but the visible height.
  const transformOf = (s: Sheet) => `translateY(calc(100% - ${heightOf(s)}))`;
  // The paper keeps the taller height until a slide down ends, so its bottom never shows early.
  const [tall, setTall] = useState<Sheet>(sheet);
  const paper = ORDER[Math.max(ORDER.indexOf(sheet), ORDER.indexOf(tall))];
  useEffect(() => {
    const el = sheetRef.current;
    const root = rootRef.current;
    if (desktop || !el || !root) return;
    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let startH = 0;
    let full = 0;
    let h = 0;
    let mode: 'idle' | 'drag' | 'scroll' = 'scroll';
    let grown = false;
    const onStart = (e: TouchEvent) => {
      dragged.current = false;
      grown = false;
      // Fields keep their own gestures, such as selecting text.
      mode = e.touches.length > 1 || (e.target as Element).closest('input, textarea, select') ? 'scroll' : 'idle';
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startAt = e.timeStamp;
      full = el.offsetHeight;
      // What shows above the resting bottom edge, even mid-slide.
      startH = h = root.getBoundingClientRect().bottom - bottomPx - el.getBoundingClientRect().top;
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'scroll') return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (mode === 'idle') {
        if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
        let scrolled = false;
        for (let n = e.target as Element | null; n && n !== el; n = n.parentElement) scrolled ||= n.scrollTop > 0;
        const handle = !!(e.target as Element).closest('[data-drag-handle]');
        // Down drags the paper once the list under the finger is at its top; up grows it until full.
        const drag = Math.abs(dy) > Math.abs(dx) && (handle || (dy > 0 ? !scrolled : h < full - 1));
        mode = drag ? 'drag' : 'scroll';
        if (!drag) return;
        el.style.transition = 'none';
        el.dataset.moving = '';
      }
      e.preventDefault();
      h = Math.min(Math.max(startH - dy, peekPx), full);
      // One layout, the first time a pull goes above where it started: the paper grows to full so
      // its end never shows. A drag down needs nothing new laid out or painted.
      if (h > startH + 1 && !grown) {
        grown = true;
        setTall('full');
      }
      el.style.transform = `translateY(${full - h}px)`;
    };
    const onEnd = (e: TouchEvent) => {
      if (mode !== 'drag') return;
      mode = 'scroll';
      dragged.current = true;
      const heights: [Sheet, number][] = [
        ['peek', peekPx],
        ['half', document.documentElement.clientHeight * 0.45],
        ['full', full],
      ];
      // A flick goes one height on in its direction; a slow drag settles at the nearest.
      const speed = (h - startH) / Math.max(1, e.timeStamp - startAt);
      const target =
        speed > 0.5
          ? (heights.find(([, v]) => v > h + 1) ?? heights[2])[0]
          : speed < -0.5
            ? ([...heights].reverse().find(([, v]) => v < h - 1) ?? heights[0])[0]
            : [...heights].sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h))[0][0];
      // The class transition takes over and slides to the target. React writes the same string.
      el.style.transition = '';
      el.style.transform = transformOf(target);
      setSheet(target);
      // Already there: no transition will run to end the slide.
      if (Math.abs(heights.find(([s]) => s === target)![1] - h) < 1) settle();
    };
    // Marks every slide, dragged or stepped, so CSS can drop costly paint while it runs.
    const settle = () => {
      delete el.dataset.moving;
      setTall(useAppStore.getState().sheet);
    };
    const onRun = (e: TransitionEvent) => {
      if (e.target === el) el.dataset.moving = '';
    };
    const onDone = (e: TransitionEvent) => {
      if (e.target === el) settle();
    };
    el.addEventListener('transitionrun', onRun);
    el.addEventListener('transitionend', onDone);
    el.addEventListener('transitioncancel', onDone);
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('transitionrun', onRun);
      el.removeEventListener('transitionend', onDone);
      el.removeEventListener('transitioncancel', onDone);
    };
    // transformOf only changes with peekPx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, bottomPx, peekPx, setSheet]);

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

  return (
    // One root for the phone layout; useKeyboardFit fits it to what the keyboard leaves visible.
    // The map shows through it, so only its children take taps.
    // Clips the part of the sheet slid below the edge.
    <div ref={rootRef} className="pointer-events-none fixed inset-x-0 top-0 z-[1000] h-dvh overflow-hidden font-atkinson">
      <section
        ref={sheetRef}
        className="pointer-events-auto absolute inset-x-2 z-[1] flex flex-col transition-transform duration-200 ease-out will-change-transform"
        style={{
          bottom: `${bottomPx}px`,
          height: `calc(100% - ${bottomPx}px - ${TOP_GAP}px)`,
          transform: transformOf(sheet),
        }}
      >
        <div className="flex shrink-0 flex-col" style={{ height: heightOf(paper) }}>
          {listView ? (
            <>
              {/* 11px: .till's 1px border outranks border-x-0, so this lands the search on the rows' 12px edge. */}
              <div ref={tillRef} data-drag-handle className="till shrink-0 border-x-0 border-b-0 px-[11px]">
                <button type="button" className="flex h-3.5 w-full cursor-grab items-center justify-center" aria-label="Resize panel" onClick={stepSheet}>
                  <span className="h-[3px] w-9 bg-[#0A0A0A] shadow-[0_1px_0_rgb(255_255_255/.14)]" />
                </button>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Search />
                  </div>
                  {authenticated && <AddKey />}
                </div>
                {/* The slot the paper feeds out of. */}
                <div className="-mx-2.5 mt-2 h-1.5 bg-[#0A0A0A] shadow-[inset_0_3px_3px_#000]" />
              </div>
              <div className="receipt flex min-h-0 flex-1 flex-col">
                <Browse mobile />
              </div>
            </>
          ) : (
            <div
              className={`tear-t flex min-h-0 flex-1 flex-col ${
                editing ? 'nota' : selected && !placing ? 'ticket' : 'receipt'
              }`}
            >
              <button
                type="button"
                className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center"
                aria-label="Resize panel"
                data-drag-handle
                onClick={stepSheet}
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
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
      {tillUp && <MobileTill tillRef={tillRef} />}
    </div>
  );
}

// The black slot the paper feeds out of, on top of the till.
const SLOT = 9;
// The handle and the first line.
const PEEK = 74;
// Room left above a full sheet.
const TOP_GAP = 16;

// The till on the bottom edge while editing; the editor portals its Cancel and Save keys here.
function MobileTill({ tillRef }: { tillRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={tillRef}
      className="till pointer-events-auto absolute inset-x-0 bottom-0 z-[2] flex items-center gap-2 border-x-0 border-b-0 px-2.5 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] before:absolute before:inset-x-0 before:-top-[9px] before:h-[9px] before:bg-[#0A0A0A] before:shadow-[inset_0_-3px_3px_#000]"
    >
      <div id="till-slot" className="flex flex-1 gap-2" />
    </div>
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
              <span className="line-clamp-2 pr-5 font-display text-[16px] leading-none font-extrabold uppercase">
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
