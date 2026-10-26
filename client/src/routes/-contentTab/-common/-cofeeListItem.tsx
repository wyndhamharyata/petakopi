import type { Coffee } from '@rpcTypes/coffee.ts';
import { useAppStore } from '@store/store.ts';
import { Rating } from './-rating.tsx';
import { memo, useCallback } from 'react';
import { RiChat3Line } from 'react-icons/ri';

export interface CoffeeListItemProps {
  // Set by "Latest Reviews" only: approved comments under the review on mwyndham.dev.
  coffee: Coffee & { commentCount?: number };
}

export const CoffeeListItem = memo(function CoffeeListItem({ coffee }: CoffeeListItemProps) {
  const optimize = (url: string) =>
    `https://${new URL(url).hostname}/cdn-cgi/image/width=100,height=100,fit=cover,quality=50,format=auto,gravity=auto${new URL(url).pathname}`;
  const optimizedUrl = optimize(
    coffee.thumbnail_url ?? 'https://resource-kopimap.mwyndham.dev/placeholder.jpg'
  );

  const setSelected = useAppStore((state) => state.setSelectedCoffee);

  const handleClick = useCallback(() => {
    setSelected(coffee);
  }, [coffee, setSelected]);

  return (
    <li className="flex cursor-pointer list-row hover:bg-base-200" onClick={handleClick}>
      <div className="flex flex-grow flex-col">
        <p className="overflow-ellipsis font-bold line-clamp-1">{coffee.name}</p>
        <p
          className="overflow-ellipsis text-xs font-light line-clamp-1 max-w-56">{[coffee.open_hours, coffee.address.split(',')[0]].filter(Boolean).join(' | ')}</p>
        <div className="flex items-center gap-3">
          <Rating ratingValue={coffee.rating} />
          {coffee.status === 'closed' && (
            <span className="badge badge-error badge-soft badge-xs">Closed permanently</span>
          )}
          {!!coffee.commentCount && (
            <span className="inline-flex items-center gap-1 text-xs">
              <RiChat3Line size={14} />
              {coffee.commentCount}
            </span>
          )}
        </div>
      </div>
      <img className="size-14 rounded-box"
           src={optimizedUrl}
           alt={coffee.name} />
    </li>
  );
});