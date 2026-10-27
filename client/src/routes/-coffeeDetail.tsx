import type { Coffee } from '@rpcTypes/coffee.ts';
import { useAppStore } from '@store/store.ts';
import useSWR from 'swr';
import { client, rpcFetch } from '../fetcher/fetcher.ts';
import { minidenticon } from 'minidenticons';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiChat3Line,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiTimeLine,
  RiMapPinLine,
  RiWalkLine,
} from 'react-icons/ri';
import { Rating } from './-contentTab/-common/-rating.tsx';
import { CoffeeListItem } from './-contentTab/-common/-cofeeListItem.tsx';
import { MiniMap } from './-miniMap.tsx';
import { PanelHeader } from './-panelHeader.tsx';
import { getTokens } from '@cookies/tokens.ts';
import { type ReactNode, memo, useEffect, useMemo, useState } from 'react';
import {
  at,
  directionsUrl,
  distance,
  formatDistance,
  formatHours,
  isTypingTarget,
  shopUrl,
} from './-util.ts';

const NEARBY_COUNT = 4;
const canShare = typeof navigator.share === 'function';

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const CoffeeDetail = memo(function CoffeeDetail({
  coffee,
}: {
  coffee: Coffee;
}) {
  const clearSelected = useAppStore((state) => state.removeSelectedCoffee);
  const startEdit = useAppStore((state) => state.startEdit);
  const userLocation = useAppStore((state) => state.userLocation);
  const { authenticated } = getTokens();

  const { data: images } = useSWR(
    `imageData:${coffee.id}`,
    rpcFetch(client.api.coffees.images[':id'].$get)({
      param: { id: coffee.id },
    }),
    { dedupingInterval: 300000 }
  );

  const { data: review } = useSWR(
    // Not `status`: a closed shop can still have a review, and only a review sets a rating.
    coffee.rating > 0 ? ['review', coffee.id] : null,
    rpcFetch(client.api.coffees.review[':id'].$get)({
      param: { id: coffee.id },
    }),
    { dedupingInterval: 300000 }
  );
  const post = review?.post;

  const { data: all } = useSWR(
    'coffees',
    rpcFetch(client.api.coffees.$get)({})
  );
  const nearby = useMemo(
    () =>
      (all ?? [])
        .filter((c) => c.id !== coffee.id)
        .map((c) => ({ c, d: distance(at(coffee), at(c)) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, NEARBY_COUNT)
        .map(({ c }) => c),
    [all, coffee]
  );

  const [copied, setCopied] = useState<'address' | 'link' | null>(null);
  const copy = (what: 'address' | 'link') => {
    navigator.clipboard.writeText(
      what === 'address' ? coffee.address : shopUrl(coffee)
    );
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  // D directions, C copy address, R full review.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      const key = e.key.toLowerCase();
      if (key === 'd') window.open(directionsUrl(coffee), '_blank');
      else if (key === 'c' && coffee.address) copy('address');
      else if (key === 'r' && post) window.open(post.url, '_blank');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coffee, post]);

  const [photo, setPhoto] = useState(0);

  // A missing fact is a button for the owner and plain text for visitors; never an empty row.
  const missing = (icon: ReactNode, label: string) =>
    authenticated ? (
      <button
        type="button"
        onClick={startEdit}
        className="flex min-h-11 w-full items-center gap-3 rounded-field border border-dashed border-base-content/25 px-3 text-left text-[15px] text-accent hover:border-accent"
      >
        {icon}
        <span className="flex-1">Add {label}</span>
        <RiAddLine size={18} />
      </button>
    ) : (
      <Fact icon={icon}>
        <span className="text-base-content/60">
          {label[0].toUpperCase() + label.slice(1)} unknown
        </span>
      </Fact>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader title={coffee.name} onBack={clearSelected} backLabel="Back">
        {coffee.status === 'reviewed' || post ? (
          <span className="badge badge-sm badge-soft badge-primary rounded-full">
            Reviewed
          </span>
        ) : (
          <span className="badge badge-sm badge-soft badge-accent rounded-full">
            Not reviewed yet
          </span>
        )}
        {coffee.status === 'closed' && (
          <span className="badge badge-sm badge-soft badge-error rounded-full">
            Closed permanently
          </span>
        )}
        {coffee.rating > 0 && (
          <>
            <Rating ratingValue={coffee.rating} />
            <span className="text-[13px] text-base-content/60">
              {coffee.rating.toFixed(1)}
            </span>
          </>
        )}
      </PanelHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="relative h-44 shrink-0 overflow-hidden rounded-box border border-base-300">
          {images && images.length > 0 ? (
            <>
              <div
                className="flex size-full snap-x snap-mandatory overflow-x-auto"
                onScroll={(e) =>
                  setPhoto(
                    Math.round(
                      e.currentTarget.scrollLeft / e.currentTarget.clientWidth
                    )
                  )
                }
              >
                {images.map((i) => (
                  <img
                    key={i.id}
                    className="size-full shrink-0 snap-center object-cover"
                    src={i.url}
                    alt={i.alt}
                  />
                ))}
              </div>
              {images.length > 1 && (
                <span className="badge badge-sm absolute bottom-2 right-2 border-0 bg-black/55 text-white">
                  {photo + 1} / {images.length}
                </span>
              )}
            </>
          ) : (
            <>
              <MiniMap lat={coffee.lat} lng={coffee.lng} />
              {images &&
                (authenticated ? (
                  <button
                    type="button"
                    className="btn btn-sm absolute bottom-2 right-2"
                    onClick={startEdit}
                  >
                    <RiAddLine size={16} /> Add photo
                  </button>
                ) : (
                  <span className="badge badge-sm absolute bottom-2 left-2 border-0 bg-base-100/85">
                    No photos yet
                  </span>
                ))}
            </>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {coffee.open_hours ? (
            <Fact icon={<RiTimeLine size={20} />}>
              {formatHours(coffee.open_hours)}
            </Fact>
          ) : (
            missing(<RiTimeLine size={20} />, 'hours')
          )}
          {coffee.address ? (
            <Fact
              icon={<RiMapPinLine size={20} />}
              extra={
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square"
                  onClick={() => copy('address')}
                  title="Copy address (C)"
                  aria-label="Copy address"
                >
                  <RiFileCopyLine size={16} />
                </button>
              }
            >
              <span className="text-[13px] leading-snug">{coffee.address}</span>
            </Fact>
          ) : (
            missing(<RiMapPinLine size={20} />, 'address')
          )}
          {userLocation && (
            <Fact icon={<RiWalkLine size={20} />}>
              <span className="text-[13px] text-base-content/60">
                {formatDistance(distance(userLocation, at(coffee)))} from you
              </span>
            </Fact>
          )}
        </div>

        <div className="flex gap-2">
          <a
            className={`btn flex-1 ${post ? 'btn-outline' : 'btn-primary'}`}
            target="_blank"
            href={directionsUrl(coffee)}
            title="Directions (D)"
          >
            Directions
          </a>
          {coffee.address && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => copy('address')}
            >
              {copied === 'address' ? 'Copied' : 'Copy address'}
            </button>
          )}
          {/* The system share sheet where there is one; elsewhere say plainly that it copies. */}
          {canShare ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                navigator
                  .share({ title: coffee.name, url: shopUrl(coffee) })
                  .catch(() => undefined)
              }
            >
              Share
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => copy('link')}
            >
              {copied === 'link' ? 'Link copied' : 'Copy link'}
            </button>
          )}
        </div>

        {post && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-bold">{post.title}</h3>
            <div
              className="max-h-36 overflow-hidden mask-b-from-40% prose prose-sm max-w-none dark:prose-invert prose-a:text-accent prose-strong:text-base-content"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
            <a
              className="btn btn-primary"
              target="_blank"
              href={post.url}
              title="Read full review (R)"
            >
              Read full review
              <RiExternalLinkLine size={16} />
            </a>
            {!!review.comments?.count && (
              // Collapsed by default so the review keeps the space.
              <details className="group [interpolate-size:allow-keywords] [&::details-content]:h-0 [&::details-content]:overflow-hidden [&::details-content]:opacity-0 [&::details-content]:transition-all [&::details-content]:duration-300 [&::details-content]:[transition-behavior:allow-discrete] open:[&::details-content]:h-auto open:[&::details-content]:opacity-100">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                  <RiChat3Line size={16} />
                  Comments ({review.comments.count})
                  <RiArrowDownSLine
                    size={16}
                    className="ml-auto shrink-0 transition-transform duration-300 group-open:rotate-180"
                  />
                </summary>
                <div className="flex flex-col gap-3 pt-2">
                  {review.comments.latest.map((comment) => (
                    <div
                      key={comment.id}
                      className={`flex gap-3 rounded-box bg-base-200 p-3 ${comment.parentId ? 'ml-6' : ''}`}
                    >
                      {/* Same seed and settings as marknotes, so the alias has the same face. */}
                      <img
                        className="size-7 shrink-0 rounded-field bg-base-300"
                        src={
                          // mwyndham.dev reserves this alias for its author's comments.
                          comment.alias === 'Wyndham'
                            ? 'https://avatars.githubusercontent.com/u/34619560?v=4&s=96'
                            : `data:image/svg+xml;utf8,${encodeURIComponent(minidenticon(comment.alias, 95, 45))}`
                        }
                        alt=""
                      />
                      <div className="min-w-0">
                        <p className="mb-1 text-[13px]">
                          <span className="font-semibold">{comment.alias}</span>{' '}
                          {comment.alias === 'Wyndham' && (
                            <span className="badge badge-primary badge-soft badge-xs mr-1">Author</span>
                          )}
                          <span className="text-base-content/60">
                            {formatDate(comment.createdAt)}
                          </span>
                        </p>
                        <p className="text-[13px] leading-relaxed text-base-content/80 line-clamp-3">
                          {comment.message}
                        </p>
                      </div>
                    </div>
                  ))}
                  <a
                    className="link link-accent text-[13px]"
                    target="_blank"
                    href={`${post.url}#comments`}
                  >
                    Join the discussion
                    <RiExternalLinkLine
                      size={14}
                      className="ml-1 inline align-[-2px]"
                    />
                  </a>
                </div>
              </details>
            )}
          </div>
        )}

        {nearby.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] font-bold">Nearby</h3>
            <ul className="-mx-2">
              {nearby.map((c) => (
                <CoffeeListItem key={c.id} coffee={c} from={at(coffee)} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {authenticated && (
        <div className="flex gap-2 border-t border-base-300 p-3">
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={startEdit}
          >
            Edit
          </button>
          <a
            className="btn btn-ghost flex-1"
            target="_blank"
            href={
              post
                ? `https://mwyndham.dev/admin/articles/${post.slug}/edit`
                : `https://mwyndham.dev/admin/articles/new?coffeeId=${coffee.id}`
            }
          >
            {post ? 'Edit review' : 'Write review'}
            <RiExternalLinkLine size={16} />
          </a>
        </div>
      )}
    </div>
  );
});

function Fact({
  icon,
  children,
  extra,
}: {
  icon: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 text-[15px]">
      <span className="shrink-0 opacity-70">{icon}</span>
      <span className="flex-1">{children}</span>
      {extra}
    </div>
  );
}
