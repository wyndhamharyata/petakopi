import type { Coffee } from '@rpcTypes/coffee.ts';
import { useAppStore } from '@store/store.ts';
import useSWR from 'swr';
import { client, rpcFetch } from '../fetcher/fetcher.ts';
import { minidenticon } from 'minidenticons';
import {
  RiChat3Line,
  RiCloseLine,
  RiTimerFlashLine,
  RiUserLocationLine,
} from 'react-icons/ri';
import { Rating } from './-contentTab/-common/-rating.tsx';
import { getTokens } from '@cookies/tokens.ts';
import { memo, useCallback } from 'react';

export interface CoffeeDetailProps {
  coffee: Coffee;
}

export const CoffeeDetail = memo(function CoffeeDetail({
  coffee,
}: CoffeeDetailProps) {
  const clearSelected = useAppStore((state) => state.removeSelectedCoffee);

  const { access } = getTokens();

  const { data: images } = useSWR(
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
    }
  );

  const { data: review } = useSWR(
    coffee.status == 'reviewed' ? ['review', coffee.id] : null,
    rpcFetch(client.api.coffees.review[':id'].$get)({
      param: {
        id: coffee.id,
      },
    }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  const handleClose = useCallback(() => {
    clearSelected();
  }, [clearSelected]);

  const withReview = !!review?.post;

  return (
    <div className="flex w-full drop-shadow-2xl h-[55vh] card bg-base-100 lg:max-h-[94vh] lg:h-fit">
      <figure className="lg:min-h-60">
        <button
          onClick={handleClose}
          className={`btn btn-circle absolute top-2 right-2 btn-xs`}
        >
          <RiCloseLine size={20} />
        </button>
        <div className="h-52 w-full carousel rounded-box lg:h-60">
          {images && images.length > 0 ? (
            images?.map((i) => (
              <div className={`carousel-item w-full`}>
                <img
                  className={`w-full object-cover`}
                  src={i.url}
                  alt={i.alt}
                />
              </div>
            ))
          ) : (
            <img
              alt="placeholder image"
              className={`w-full object-cover`}
              src="https://resource-kopimap.mwyndham.dev/placeholder.jpg"
            />
          )}
        </div>
      </figure>
      <div className="flex min-h-0 p-0 pb-3 card-body">
        <p className="max-h-10 overflow-ellipsis px-3 pt-3 text-lg font-bold line-clamp-1 min-h-8">
          {coffee.name}
        </p>
        <div className={`px-3 pb-2`}>
          <Rating ratingValue={coffee.rating} />
        </div>
        <div className="flex flex-row items-center overflow-ellipsis px-3 py-2 font-light line-clamp-2 hover:bg-base-200">
          <RiTimerFlashLine className={`mr-4`} size={20} />
          <p className={`flex-1/2`}>{`${coffee.open_hours}`}</p>
        </div>
        <div className="flex flex-row items-center overflow-ellipsis px-3 font-light min-h-8 hover:bg-base-200">
          <RiUserLocationLine className={`mr-4`} size={20} />
          <p className={`text-xs flex-1/2`}>{`${coffee.address}`}</p>
        </div>
        {withReview && (
          <div className="hidden overflow-y-scroll px-4 lg:block">
            <div
              className="mx-auto w-full overflow-x-clip overflow-y-scroll prose-pre:bg-slate-900 prose-strong:font-extrabold prose-a:font-extrabold prose-pre:text-white caret-rose-800 prose-strong:brightness-50 prose-em:brightness-50 prose-a:brightness-90 prose prose-slate prose-em:text-secondary prose-strong:text-primary prose-a:text-accent prose-sm focus:outline-hidden dark:prose-a:brightness-100 dark:prose-strong:brightness-100 dark:prose-em:brightness-100 dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: review?.post?.html ?? '',
              }}
            />
          </div>
        )}
        {withReview && !!review?.comments?.count && (
          <>
            <div className="mx-3 mt-2 hidden shrink-0 flex-col gap-2 lg:flex">
              <p className="flex items-center gap-2 pt-1 text-sm font-bold">
                <RiChat3Line size={16} />
                Comments ({review.comments.count})
              </p>
              {review.comments.latest.map((comment) => (
                <div
                  key={comment.id}
                  className={`flex gap-2 ${comment.parentId ? 'ml-6' : ''}`}
                >
                  {/* Same seed and settings as marknotes, so the alias has the same face. */}
                  <div className="avatar shrink-0">
                    <div className="w-7 mask mask-squircle bg-base-300 ring-1 ring-base-content/40">
                      <img
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(minidenticon(comment.alias, 95, 45))}`}
                        alt={comment.alias}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold">{comment.alias}</span>{' '}
                      <span className="text-base-content/50">
                        {new Date(comment.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </p>
                    <p className="text-xs text-base-content/80 line-clamp-2">
                      {comment.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mx-3 mt-1 flex items-center gap-2 text-xs lg:hidden">
              <RiChat3Line size={16} className="shrink-0" />
              <span className="font-semibold">{review.comments.count}</span>
              <span className="line-clamp-1 text-base-content/80">
                {review.comments.latest[0]?.alias}: {review.comments.latest[0]?.message}
              </span>
            </div>
          </>
        )}
        {withReview ? (
          <div className="mt-auto flex flex-row lg:mt-0">
            <a
              className={`btn btn-primary mx-3 mt-3 flex-grow`}
              target="_blank"
              href={`${review?.post?.url}#comments`}
            >
              Read Review and Comment
            </a>
            {access && access !== '' ? (
              <a
                className={`btn btn-accent btn-outline mr-3 mt-3`}
                href={`/${coffee.id}/edit`}
              >
                Edit
              </a>
            ) : (
              <a
                className={`btn btn-accent btn-outline mr-3 mt-3`}
                target="_blank"
                href={`https://www.google.com/maps/dir/?api=1&destination=${coffee.lat},${coffee.lng}&origin=My+Location&travelmode=driving`}
              >
                Go Here
              </a>
            )}
          </div>
        ) : access && access !== '' ? (
          <div className="mt-auto flex flex-row lg:mt-0">
            <a
              className={`btn btn-primary mx-3 mt-3 flex-grow`}
              target="_blank"
              href={`https://mwyndham.dev/admin/articles/new?coffeeId=${coffee.id}`}
            >
              Write Review
            </a>
            <a
              className={`btn btn-accent btn-outline mr-3 mt-3`}
              href={`/${coffee.id}/edit`}
            >
              Edit
            </a>
          </div>
        ) : (
          <a
            className={`btn btn-primary mx-3 mt-auto lg:mt-3`}
            target="_blank"
            href={`https://www.google.com/maps/dir/?api=1&destination=${coffee.lat},${coffee.lng}&origin=My+Location&travelmode=driving`}
          >
            Go Here
          </a>
        )}
      </div>
    </div>
  );
});
