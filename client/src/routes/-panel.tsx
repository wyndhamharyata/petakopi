import { useEffect, useRef, useState } from 'react';
import { RiAddLine } from 'react-icons/ri';
import useSWR from 'swr';
import { type Sheet, useAppStore } from '@store/store.ts';
import { getTokens } from '@cookies/tokens.ts';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { Browse } from './-browse.tsx';
import { CoffeeDetail } from './-coffeeDetail.tsx';
import { Editor } from './-coffeeEditor/-editor.tsx';
import { findExistingShop, readGoogleMapsLink } from './-googleMaps.ts';
import { area, useDesktop } from './-util.ts';

const HEIGHT: Record<Sheet, string> = {
  peek: 'h-24',
  half: 'h-[50dvh]',
  full: 'h-[92dvh]',
};
const ORDER: Sheet[] = ['peek', 'half', 'full'];

// One panel for everything: a left column on desktop, a bottom sheet on mobile.
export function Panel() {
  const selected = useAppStore((state) => state.selectedCoffee);
  const editing = useAppStore((state) => state.editing);
  const placing = useAppStore((state) => state.placing);
  const sheet = useAppStore((state) => state.sheet);
  const setSheet = useAppStore((state) => state.setSheet);
  const startAdd = useAppStore((state) => state.startAdd);
  const stopEdit = useAppStore((state) => state.stopEdit);
  const { authenticated } = getTokens();
  const importShop = useAppStore((state) => state.importShop);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const { data: shops } = useSWR('coffees', rpcFetch(client.api.coffees.$get)({}));
  const [linkError, setLinkError] = useState('');
  const desktop = useDesktop();
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

  // Drag the handle up or down a step; a tap moves up, or back to half from full.
  const dragStart = useRef(0);
  const onPointerUp = (e: React.PointerEvent) => {
    const dy = e.clientY - dragStart.current;
    const i = ORDER.indexOf(sheet);
    if (Math.abs(dy) < 8) setSheet(sheet === 'full' ? 'half' : ORDER[i + 1]);
    else if (dy < -40) setSheet(ORDER[Math.min(i + 1, 2)]);
    else if (dy > 40) setSheet(ORDER[Math.max(i - 1, 0)]);
  };

  // One row: the peek sheet is shallow, and the map below it must stay tappable.
  const placingSlip = (
    <div className="flex flex-col gap-2 px-4 py-3 lg:py-4">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
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
      {linkError && <p className="text-[13px] text-error">{linkError}</p>}
    </div>
  );

  // Desktop: the till and receipt stay on the left, the open shop hangs on the right as a ticket.
  if (desktop) {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-4 left-4 z-[1000] flex w-[400px] flex-col font-atkinson">
          <Browse slip={placing ? placingSlip : undefined} rolled={editing} />
        </div>
        <Rail ticket={editing || !!selected} />
        {(editing || selected) && (
          <div className="absolute top-7 right-4 bottom-4 z-[1001] flex w-[384px] flex-col font-atkinson">
            {editing ? (
              <div className="paper flex min-h-0 flex-1 flex-col border border-base-content/30 shadow-xl">
                <Editor key={selected?.id ?? 'new'} coffee={selected ?? undefined} />
              </div>
            ) : (
              selected && <CoffeeDetail key={selected.id} coffee={selected} />
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <aside
      className={`fixed inset-x-0 bottom-0 z-[1000] flex flex-col border-t border-base-content/30 font-atkinson shadow-[0_-8px_24px_-12px_rgb(0_0_0/.3)] transition-[height] duration-300 ease-out paper ${HEIGHT[sheet]}`}
    >
      {authenticated && selected && !editing && !placing && (
        <button
          type="button"
          className="key key-cobalt absolute -top-16 right-4 size-12 px-0"
          onClick={startAdd}
          title="Add a shop"
          aria-label="Add a shop"
        >
          <RiAddLine size={26} />
        </button>
      )}
      <button
        type="button"
        className="flex h-5 shrink-0 cursor-grab touch-none items-center justify-center"
        aria-label="Resize panel"
        onPointerDown={(e) => {
          dragStart.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={onPointerUp}
      >
        <span className="h-1 w-10 bg-base-content/20" />
      </button>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {placing ? (
          placingSlip
        ) : editing ? (
          <Editor key={selected?.id ?? 'new'} coffee={selected ?? undefined} />
        ) : selected ? (
          <CoffeeDetail key={selected.id} coffee={selected} />
        ) : (
          <Browse />
        )}
      </div>
    </aside>
  );
}

// The steel rail along the top, and the stubs of shops opened before the open one.
function Rail({ ticket }: { ticket: boolean }) {
  const rail = useAppStore((state) => state.rail);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const takeDown = useAppStore((state) => state.takeDown);
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
          <li key={c.id} className="relative shrink-0">
            <button
              type="button"
              className="ticket h-24 w-[168px] cursor-pointer px-3 pt-[15px] pb-2.5 text-left"
              onClick={() => setSelected(c)}
              title={`Open ${c.name}`}
            >
              <span className="hold" />
              <span className="line-clamp-2 pr-5 font-display text-[19px] leading-none font-extrabold uppercase">
                {c.name}
              </span>
              <span className="mt-2 flex items-center gap-1.5 font-mono text-[13px]">
                {c.status === 'reviewed' ? (
                  <span className="stamp">Reviewed {c.rating.toFixed(1)}</span>
                ) : c.status === 'closed' ? (
                  <span className="stamp stamp-ink">Closed</span>
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
              className="absolute top-3 right-1 z-[3] grid size-6 cursor-pointer place-items-center border-[1.5px] border-base-content bg-[#F6F6F6] font-mono text-[15px] font-bold"
              onClick={() => takeDown(c.id)}
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
