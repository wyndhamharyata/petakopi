import type { Coffee } from '@rpcTypes/coffee.ts';
import { type LatLng, useAppStore } from '@store/store.ts';
import { memo } from 'react';
import { RiChat3Line, RiMapPin2Line } from 'react-icons/ri';
import { area, at, distance, formatDistance } from '../../-util.ts';

export interface CoffeeListItemProps {
  // Set by "Latest Reviews" only: approved comments under the review on mwyndham.dev.
  coffee: Coffee & { commentCount?: number };
  highlighted?: boolean;
  // Distance is measured from here: the visitor by default, the open shop for "Nearby".
  from?: LatLng | null;
}

const optimize = (url: string) =>
  `https://${new URL(url).hostname}/cdn-cgi/image/width=96,height=96,fit=cover,quality=50,format=auto,gravity=auto${new URL(url).pathname}`;

export const CoffeeListItem = memo(function CoffeeListItem({
  coffee,
  highlighted = false,
  from,
}: CoffeeListItemProps) {
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const userLocation = useAppStore((state) => state.userLocation);
  const open = useAppStore((state) => state.selectedCoffee?.id === coffee.id);
  const origin = from === undefined ? userLocation : from;

  return (
    <li>
      <button
        type="button"
        onClick={() => setSelected(coffee)}
        className={`grid min-h-[58px] w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)] items-center gap-3 border-b border-dashed border-base-content/30 px-1.5 py-2 text-left hover:bg-base-content/5 ${
          highlighted ? 'outline-2 -outline-offset-2 outline-base-content' : ''
        } ${open ? 'row-sel' : ''}`}
      >
        {coffee.thumbnail_url ? (
          <span className="halftone size-10">
            <img src={optimize(coffee.thumbnail_url)} alt="" loading="lazy" />
          </span>
        ) : (
          <span className="halftone grid size-10 place-items-center">
            <RiMapPin2Line size={18} />
          </span>
        )}
        <span className="min-w-0">
          <span
            className={`block truncate text-[15px] font-semibold ${coffee.status === 'closed' ? 'line-through' : ''}`}
          >
            {coffee.name}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-[13px]">
            {coffee.status === 'closed' ? (
              <span className="stamp stamp-ink">Closed</span>
            ) : coffee.status === 'reviewed' ? (
              <span className="stamp">Reviewed {coffee.rating.toFixed(1)}</span>
            ) : (
              coffee.rating > 0 && (
                <span className="inline-flex items-center gap-0.5 font-bold">
                  <i className="cup" />
                  {coffee.rating.toFixed(1)}
                </span>
              )
            )}
            {coffee.address && <span className="truncate">{area(coffee.address)}</span>}
            {!!coffee.commentCount && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <RiChat3Line size={13} />
                {coffee.commentCount}
              </span>
            )}
            {origin && (
              <>
                <i className="leader" />
                <span className="shrink-0 font-bold">
                  {formatDistance(distance(origin, at(coffee)))}
                </span>
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  );
});
