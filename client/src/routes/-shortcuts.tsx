import { useEffect, useRef } from 'react';
import { useAppStore } from '@store/store.ts';
import { isTypingTarget } from './-util.ts';

// D, C and R live in the shop view and L in the map layer, next to what they act on.
const KEYS: [string, string][] = [
  ['Esc', 'Back one step'],
  ['⌘K  /', 'Search'],
  ['↑ ↓  Enter', 'Move through the list, open a shop'],
  ['J  K', 'Next / previous shop'],
  ['D', 'Directions'],
  ['C', 'Copy address'],
  ['R', 'Read the full review'],
  ['L', 'My location'],
  ['1  2', 'Latest reviews / All places'],
  ['?', 'This list'],
];

const focusSearch = () => {
  const state = useAppStore.getState();
  if (state.editing || state.placing) return;
  state.removeSelectedCoffee();
  if (state.sheet === 'peek') state.setSheet('half');
  // Browse mounts on the next render when a shop was open.
  setTimeout(() => document.getElementById('search-bar')?.focus());
};

export function Shortcuts() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = useAppStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        return focusSearch();
      }
      // The editor handles its own Esc (it may ask before discarding); open dialogs close themselves.
      if (e.key === 'Escape') {
        if (state.editing || document.querySelector('dialog[open]')) return;
        if (state.placing) return state.stopEdit();
        if (state.selectedCoffee) return state.removeSelectedCoffee();
        if (state.query) return state.setQuery('');
        return;
      }
      if (isTypingTarget(e) || state.editing || state.placing) return;

      if (e.key === '/') {
        e.preventDefault();
        focusSearch();
      } else if (e.key === '?') {
        if (dialog.current?.open) dialog.current.close();
        else dialog.current?.showModal();
      } else if ((e.key === '1' || e.key === '2') && !state.selectedCoffee) {
        state.setTab(e.key === '1' ? 'latestReviews' : 'allPlaces');
      } else if ((e.key === 'j' || e.key === 'k') && state.selectedCoffee) {
        const list = state.browseList;
        const i = list.findIndex((c) => c.id === state.selectedCoffee?.id);
        const next = list[i + (e.key === 'j' ? 1 : -1)];
        if (i !== -1 && next) state.setSelectedCoffee(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <dialog ref={dialog} className="modal font-atkinson">
      <div className="modal-box max-w-sm rounded-box border border-base-300 p-5">
        <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-base-content/60">
          Keyboard shortcuts
        </h3>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[15px]">
          {KEYS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt className="flex gap-1">
                {key.split('  ').map((k) => (
                  <kbd key={k} className="kbd kbd-sm">
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>Close</button>
      </form>
    </dialog>
  );
}
