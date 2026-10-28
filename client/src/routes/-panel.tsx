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

  return (
    <aside
      className={`fixed inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-[1.25rem] border-t border-base-300 bg-base-100 font-atkinson shadow-[0_-8px_24px_-12px_rgb(0_0_0/.3)] transition-[height] duration-300 ease-out ${HEIGHT[sheet]} lg:absolute lg:inset-x-auto lg:top-4 lg:bottom-4 lg:left-4 lg:h-auto lg:w-[400px] lg:rounded-box lg:border lg:shadow-xl`}
    >
      {authenticated && !editing && !placing && (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg absolute -top-16 right-4 shadow-lg lg:top-auto lg:bottom-0 lg:-right-20"
          onClick={startAdd}
          title="Add a shop"
          aria-label="Add a shop"
        >
          <RiAddLine size={26} />
        </button>
      )}
      <button
        type="button"
        className="flex h-5 shrink-0 cursor-grab touch-none items-center justify-center lg:hidden"
        aria-label="Resize panel"
        onPointerDown={(e) => {
          dragStart.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={onPointerUp}
      >
        <span className="h-1 w-10 rounded-full bg-base-content/20" />
      </button>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:rounded-box">
        {placing ? (
          // One row: the peek sheet is shallow, and the map below it must stay tappable.
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
              <button type="button" className="btn btn-ghost btn-sm" onClick={stopEdit}>
                Cancel
              </button>
            </div>
            {linkError && <p className="text-[13px] text-error">{linkError}</p>}
          </div>
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
