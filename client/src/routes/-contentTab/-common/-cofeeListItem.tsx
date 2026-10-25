import useSWR from 'swr';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
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
  const { data } = useSWR(
    `imageData:${coffee.id}`,
    rpcFetch(client.api.coffees.images[':id'].$get)({
      param: {
        id: coffee.id,
      },
    }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // 5 minutes for images
    },
  );

  const hasImages = data && data.length > 0;
  const imagePath = hasImages ? new URL(data[0].url).pathname : '';
  const optimizedUrl = hasImages ? 'https://' + new URL(data[0].url).hostname + '/cdn-cgi/image/width=100,height=100,fit=cover,quality=50,format=auto,gravity=auto' + imagePath : 'https://resource-kopimap.mwyndham.dev/cdn-cgi/image/width=100,height=100,fit=cover,quality=50,format=auto,gravity=auto/placeholder.jpg';

  const setSelected = useAppStore((state) => state.setSelectedCoffee);

  const handleClick = useCallback(() => {
    setSelected(coffee);
  }, [coffee, setSelected]);

  return (
    <li className="flex cursor-pointer list-row hover:bg-base-200" onClick={handleClick}>
      <div className="flex flex-grow flex-col">
        <p className="overflow-ellipsis font-bold line-clamp-1">{coffee.name}</p>
        <p
          className="overflow-ellipsis text-xs font-light line-clamp-1 max-w-56">{`${coffee.open_hours} | ${coffee.address.split(',')[0]}`}</p>
        <div className="flex items-center gap-3">
          <Rating ratingValue={coffee.rating} />
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
           alt={hasImages ? data[0].alt : 'Placeholder alt text'} />
    </li>
  );
});