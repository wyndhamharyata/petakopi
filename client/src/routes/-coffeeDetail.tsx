import type { Coffee } from '@rpcTypes/coffee.ts';
import { useAppStore } from '@store/store.ts';
import useSWR from 'swr';
import { client, rpcFetch } from '../fetcher/fetcher.ts';
import { minidenticon } from 'minidenticons';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLinkM,
  RiRouteLine,
  RiShareLine,
} from 'react-icons/ri';
import { CoffeeListItem } from './-contentTab/-common/-cofeeListItem.tsx';
import { MiniMap } from './-miniMap.tsx';
import { getTokens } from '@cookies/tokens.ts';
import { type ReactNode, memo, useEffect, useMemo, useState } from 'react';
import {
  at,
  directionsUrl,
  distance,
  formatDistance,
  formatHours,
  isTypingTarget,
  useDesktop,
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
  const desktop = useDesktop();

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

  // A missing fact is a link for the owner and plain text for visitors; never an empty row.
  const missing = (label: string) =>
    authenticated ? (
      <button type="button" onClick={startEdit} className="cursor-pointer font-bold text-accent underline underline-offset-3">
        Add {label}
      </button>
    ) : (
      'Unknown'
    );

  const reviewed = coffee.status === 'reviewed' || !!post;

  return (
    // On a phone the sheet is the ticket; its keys move to the till.
    <div className={`flex min-h-0 flex-1 flex-col ${desktop ? 'ticket hang' : ''}`}>
      <span className="hold max-lg:hidden" />
      <span className="eyelet" data-eyelet />
      <div className="ticket-fade flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-7 pb-12 [&>*]:shrink-0">
        <header className="flex items-start gap-2.5">
          <h2 className="flex-1 font-display text-[30px] leading-[0.94] font-black uppercase text-balance lg:text-[34px]">
            {coffee.name}
          </h2>
          <button
            type="button"
            className="key key-sm w-8 px-0"
            onClick={clearSelected}
            title="Close (Esc)"
            aria-label="Close"
          >
            <RiCloseLine size={18} />
          </button>
        </header>

        {(reviewed || coffee.status === 'closed' || coffee.rating > 0) && (
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            {reviewed && <span className="stamp stamp-lg [--r:-3deg]">Reviewed</span>}
            {coffee.status === 'closed' && (
              <span className="stamp stamp-ink stamp-lg [--r:2deg]">Closed</span>
            )}
            {coffee.rating > 0 && (
              <>
                <Cups rating={coffee.rating} />
                <b className="font-mono text-[15px]">{coffee.rating.toFixed(1)}</b>
              </>
            )}
          </div>
        )}

        <div className="prints mt-5">
          <span className="sheet" />
          <span className="sheet" />
          <div className="top">
            <i className="corner" />
            <i className="corner" />
            <i className="corner" />
            <i className="corner" />
            {images && images.length > 0 ? (
              <div
                className="flex size-full snap-x snap-mandatory overflow-x-auto"
                onScroll={(e) =>
                  setPhoto(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
                }
              >
                {images.map((i) => (
                  <img key={i.id} className="size-full shrink-0 snap-center object-cover" src={i.url} alt={i.alt} />
                ))}
              </div>
            ) : (
              <MiniMap lat={coffee.lat} lng={coffee.lng} />
            )}
          </div>
          {images && images.length > 1 && (
            <span className="tag absolute -right-1.5 -bottom-2.5 z-[2]">
              {photo + 1} / {images.length}
            </span>
          )}
          {images?.length === 0 &&
            (authenticated ? (
              <button type="button" className="key key-sm absolute right-3 bottom-3 z-[2]" onClick={startEdit}>
                <RiAddLine size={16} /> Add photo
              </button>
            ) : (
              <span className="tag absolute -right-1.5 -bottom-2.5 z-[2]">No photos yet</span>
            ))}
        </div>

        <dl className="font-mono text-[14px]">
          <Fact label="Hours">
            {coffee.open_hours ? formatHours(coffee.open_hours) : missing('hours')}
          </Fact>
          {userLocation && (
            <Fact label="From you">{formatDistance(distance(userLocation, at(coffee)))}</Fact>
          )}
          <div className="border-b border-dashed border-base-content/25 py-2">
            <dt className="text-[#4D4D4D]">Address</dt>
            <dd className="mt-1 font-atkinson text-[14px] leading-snug">
              {coffee.address || missing('address')}
            </dd>
          </div>
        </dl>

        <div className="mt-4 mb-6 flex gap-2 max-lg:hidden">
          <a
            className={`key flex-1 ${post ? '' : 'key-signal'}`}
            target="_blank"
            href={directionsUrl(coffee)}
            title="Directions (D)"
          >
            <RiRouteLine size={16} />
            Directions
          </a>
          {coffee.address && (
            <button type="button" className="key" onClick={() => copy('address')} title="Copy address (C)">
              <RiFileCopyLine size={16} />
              {copied === 'address' ? 'Copied' : 'Copy address'}
            </button>
          )}
          {/* The system share sheet where there is one; elsewhere it copies the link. */}
          <button
            type="button"
            className="key w-10 px-0"
            onClick={() =>
              canShare
                ? navigator.share({ title: coffee.name, url: shopUrl(coffee) }).catch(() => undefined)
                : copy('link')
            }
            title={canShare ? 'Share' : copied === 'link' ? 'Link copied' : 'Copy link'}
            aria-label={canShare ? 'Share' : 'Copy link'}
          >
            {canShare ? <RiShareLine size={16} /> : copied === 'link' ? '✓' : <RiLinkM size={16} />}
          </button>
        </div>

        {post && (
          <section className="clipping mx-1 mb-6">
            <span className="tape" />
            <h3 className="mb-2 text-[18px] leading-tight font-bold">{post.title}</h3>
            <div
              className="prose prose-sm max-h-32 max-w-none overflow-hidden mask-b-from-40% prose-a:text-accent prose-strong:text-base-content"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
            <a className="key key-signal mt-2 w-full" target="_blank" href={post.url} title="Read full review (R)">
              Read full review
              <RiExternalLinkLine size={16} />
            </a>
          </section>
        )}

        {post && !!review.comments?.count && (
          // Collapsed by default so the review keeps the space.
          <details className="group mb-5 [interpolate-size:allow-keywords] [&::details-content]:h-0 [&::details-content]:overflow-hidden [&::details-content]:opacity-0 [&::details-content]:transition-all [&::details-content]:duration-300 [&::details-content]:[transition-behavior:allow-discrete] open:[&::details-content]:h-auto open:[&::details-content]:opacity-100">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 border-y-[1.5px] border-base-content font-display text-[20px] font-extrabold uppercase [&::-webkit-details-marker]:hidden">
              Comments
              <span className="ml-auto font-mono text-[14px] font-bold">{review.comments.count}</span>
              <RiArrowDownSLine size={18} className="shrink-0 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-3 pt-3">
              {review.comments.latest.map((comment) => (
                <div
                  key={comment.id}
                  className={`flex gap-3 border-b border-dashed border-base-content/25 pb-3 ${comment.parentId ? 'ml-6' : ''}`}
                >
                  {/* Same seed and settings as marknotes, so the alias has the same face. */}
                  <img
                    className="size-7 shrink-0 bg-white/50 outline outline-base-content/30"
                    src={
                      // mwyndham.dev reserves this alias for its author's comments.
                      comment.alias === 'Wyndham'
                        ? 'https://avatars.githubusercontent.com/u/34619560?v=4&s=96'
                        : `data:image/svg+xml;utf8,${encodeURIComponent(minidenticon(comment.alias, 95, 45))}`
                    }
                    alt=""
                  />
                  <div className="min-w-0">
                    <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[13px]">
                      <span className="font-semibold">{comment.alias}</span>
                      {comment.alias === 'Wyndham' && <span className="stamp">Author</span>}
                      <span className="font-mono">{formatDate(comment.createdAt)}</span>
                    </p>
                    <p className="text-[13px] leading-relaxed line-clamp-3">{comment.message}</p>
                  </div>
                </div>
              ))}
              <a className="text-[13px] font-bold text-accent underline" target="_blank" href={`${post.url}#comments`}>
                Join the discussion
                <RiExternalLinkLine size={14} className="ml-1 inline align-[-2px]" />
              </a>
            </div>
          </details>
        )}

        {nearby.length > 0 && (
          <div className="relative mx-0.5 mb-4 drop-shadow-[0_4px_5px_rgb(0_0_0/.16)]">
            <span className="staple left-6" />
            <span className="staple right-6" />
            <div className="receipt tear-b px-3 pt-3 pb-5">
              <h3 className="mb-1 font-display text-[20px] font-extrabold uppercase">Nearby</h3>
              <ul>
                {nearby.map((c) => (
                  <CoffeeListItem key={c.id} coffee={c} from={at(coffee)} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {authenticated && (
        <div className="flex gap-2 border-t border-dashed border-base-content/40 p-3">
          <button type="button" className="key flex-1" onClick={startEdit}>
            Edit
          </button>
          <a
            className="key flex-1"
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

// Five cups on a stamp card; half cups for .5.
function Cups({ rating }: { rating: number }) {
  return (
    <span className="cups" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={rating >= n ? 'f' : rating >= n - 0.5 ? 'h' : ''} />
      ))}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center border-b border-dashed border-base-content/25">
      <dt className="text-[#4D4D4D]">{label}</dt>
      <i className="leader" />
      <dd className="font-bold">{children}</dd>
    </div>
  );
}
