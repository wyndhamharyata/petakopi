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
  const origin = from === undefined ? userLocation : from;

  const meta = [
    coffee.address && area(coffee.address),
    origin && formatDistance(distance(origin, at(coffee))),
  ].filter(Boolean);

  return (
    <li>
      <button
        type="button"
        onClick={() => setSelected(coffee)}
        className={`flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-box px-2 py-2 text-left hover:bg-base-200 ${
          highlighted ? 'outline-2 -outline-offset-2 outline-primary' : ''
        }`}
      >
        {coffee.thumbnail_url ? (
          <img
            className="size-12 shrink-0 rounded-box object-cover"
            src={optimize(coffee.thumbnail_url)}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-box bg-base-200 text-accent">
            <RiMapPin2Line size={20} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{coffee.name}</span>
          <span className="block truncate text-[13px] text-base-content/60">
            {coffee.status === 'closed' ? (
              <span className="text-error">Closed</span>
            ) : coffee.status === 'reviewed' ? (
              <span className="text-primary">★ {coffee.rating.toFixed(1)}</span>
            ) : coffee.rating > 0 ? (
              <span>★ {coffee.rating.toFixed(1)}</span>
            ) : (
              <span className="text-accent">Not reviewed</span>
            )}
            {meta.map((m) => ` · ${m}`)}
            {!!coffee.commentCount && (
              <span className="ml-1 inline-flex items-center gap-1 align-middle">
                · <RiChat3Line size={13} />
                {coffee.commentCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
});
