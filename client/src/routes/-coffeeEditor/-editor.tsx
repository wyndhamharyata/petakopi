import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type InferOutput, safeParse } from 'valibot';
import { type Coffee, ModifyCoffeeSchema } from '@rpcTypes/coffee.ts';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import useSWR from 'swr';
import type { Image } from '@rpcTypes/image.ts';
import { RiDeleteBin3Line } from 'react-icons/ri';
import { Rating } from '../-contentTab/-common/-rating.tsx';

interface TypedResponse<T> extends Response {
  json(): Promise<T>;
}

export interface EditorProps {
  id?: string | undefined;
  submitQuery: (input: InferOutput<typeof ModifyCoffeeSchema>) => Promise<
    TypedResponse<{
      success: boolean;
      id: string;
    }>
  >;
}

export function Editor({ id = undefined, submitQuery }: EditorProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const shouldFetch: boolean = !!id;
  const { data, isLoading } = useSWR(
    shouldFetch ? ['coffees', id] : null,
    rpcFetch(client.api.coffees[':id'].$get)({
      param: {
        id: id ? id : '',
      },
    })
  );

  const [images, setImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [savedId, setSavedId] = useState('');
  const [state, setState] = useState<'new' | 'loading' | 'success' | 'failure'>(
    shouldFetch && isLoading ? 'loading' : 'new'
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setState('loading');

      const form = formRef.current;
      if (!form) return setState('failure');

      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());
      const parsed = safeParse(ModifyCoffeeSchema, {
        ...values,
        closed: formData.get('closed') === 'on',
        rating: formData.has('rating') ? Number(formData.get('rating')) : undefined,
      });

      if (!parsed.success) return setState('failure');

      const res = await submitQuery(parsed.output);
      if (!res.ok) return setState('failure');

      const data = await res.json();
      if (!data.success) return setState('failure');

      if (removedImages.length > 0) {
        for (const img of removedImages) {
          const res = await client.api.coffees.images[':id'].$delete({
            param: { id: img },
          });
          if (!res.ok) console.warn('Image deletion failed');
          const body = await res.json();
          if (!body.success) console.warn('Image deletion failed');
        }
      }

      // Before uploads, which append after the saved order.
      const order = formData.get('imageOrder');
      if (order) {
        const orderRes = await client.api.coffees.images.order.$post({
          json: { coffeeId: data.id, ids: String(order).split(',') },
        });
        if (!orderRes.ok) console.warn('Image reorder failed');
      }

      const imageEntries = [...formData.entries()].filter(([k]) =>
        k.startsWith('input-image')
      );
      for (const [, file] of imageEntries) {
        const imgRes = await client.api.coffees.images.$put({
          form: {
            id: data.id,
            file: file as File,
          },
        });

        if (!imgRes.ok) console.warn('Image upload failed');
      }

      setSavedId(data.id);
      setState('success');
    },
    [submitQuery, removedImages, formRef]
  );

  useEffect(() => {
    if (state === 'loading' && !isLoading) {
      setState('new');
    }
  }, [isLoading]);

  const coffee = data ? data.coffee : undefined;

  const onImageRemoved = useCallback(
    (img: string) => {
      setRemovedImages([...removedImages, img]);
    },
    [removedImages]
  );

  const shopProps = {
    coffee,
    images,
    setImages,
    onSubmit: handleSubmit,
    onImageRemoved,
    loading: state === 'loading',
  };

  return (
    <div className="absolute inset-0 grid-bg">
      <form
        ref={formRef}
        className="absolute inset-0 flex h-full flex-col bg-linear-to-bl from-secondary/10 via-accent/10 to-base-100/10"
      >
        {state === 'success' ? (
          <SuccessMessage
            coffeeId={savedId}
            editing={shouldFetch}
            review={coffee?.review ?? null}
          />
        ) : (
          // Remount once the shop loads: inputs read their default values only on mount.
          <AddShopForm key={coffee?.id ?? 'new'} {...shopProps} />
        )}
      </form>
    </div>
  );
}

interface Review {
  slug: string;
  title: string;
}

interface AddShopProps {
  images: string[];
  coffee: (Coffee & { review: Review | null }) | undefined;
  loading: boolean;
  setImages: (v: string[]) => void;
  onImageRemoved: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}

function AddShopForm({
  images,
  setImages,
  onSubmit,
  onImageRemoved,
  loading,
  coffee,
}: AddShopProps) {
  const [existingImages, setExistingImages] = useState<Image[]>([]);

  const { data: imageExisting } = useSWR(
    coffee ? `imageData:${coffee.id}` : null,
    rpcFetch(client.api.coffees.images[':id'].$get)({
      param: {
        id: coffee?.id ?? '',
      },
    }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // 5 minutes for images
    }
  );

  useEffect(() => {
    if (!imageExisting) {
      return;
    }

    setExistingImages(imageExisting);
  }, [imageExisting]);

  const latLongValue = useMemo(() => {
    return coffee?.lat ? `${coffee.lat}, ${coffee.lng}` : '';
  }, [coffee?.lat, coffee?.lng]);

  const handleAddImage = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setImages([...images, `input-image-${images.length}`]);
    },
    [images, setImages]
  );

  const thumbnail = existingImages[0];

  return (
    <fieldset
      className="m-auto flex max-h-[92%] w-[calc(100%-1rem)] max-w-4xl flex-col overflow-y-auto border rounded-box border-base-300 bg-base-200 shadow-2xl"
      disabled={loading}
    >
      <div
        className={`relative h-44 shrink-0 overflow-hidden rounded-t-box ${thumbnail ? '' : 'bg-neutral'}`}
      >
        {thumbnail && (
          <img
            src={thumbnail.url}
            alt={thumbnail.alt}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
        {coffee && (
          <span className="badge badge-sm absolute right-4 top-4 border-white/60 bg-black/40 text-white capitalize">
            {coffee.status}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-4 text-white">
          <p className="text-xs uppercase tracking-widest text-white/70">
            {coffee ? 'Edit Shop' : 'Add Shop'}
          </p>
          <h2 className="text-2xl font-extrabold">{coffee?.name ?? 'New coffee shop'}</h2>
          {coffee && (
            <p className="text-xs text-white/70">
              Added {formatDate(coffee.created_at)} · last edited {formatDate(coffee.updated_at)}
            </p>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3 border-b border-base-300 p-6">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold">Photos</h3>
          {existingImages.length > 1 && (
            <span className="text-xs text-base-content/50">
              Click a photo to make it the thumbnail
            </span>
          )}
        </div>
        <input
          type="hidden"
          name="imageOrder"
          value={existingImages.map((i) => i.id).join(',')}
        />
        <div className="flex gap-2 overflow-x-auto p-1">
          {existingImages.map((image, index) => (
            <div key={image.id} className="group relative size-20 shrink-0">
              <button
                type="button"
                aria-label={index === 0 ? 'Thumbnail' : 'Make thumbnail'}
                className={`size-full overflow-hidden rounded-box ${
                  index === 0
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-200'
                    : 'opacity-80 hover:opacity-100'
                }`}
                onClick={() =>
                  setExistingImages([image, ...existingImages.filter((i) => i.id !== image.id)])
                }
              >
                <img src={image.url} alt={image.alt} className="size-full object-cover" />
              </button>
              {index === 0 && (
                <span className="badge badge-primary badge-xs absolute -bottom-1 left-1/2 -translate-x-1/2">
                  1st
                </span>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                className="absolute -right-1 -top-1 hidden size-6 items-center justify-center rounded-full bg-base-content text-base-100 group-hover:flex"
                onClick={() => {
                  onImageRemoved(image.id);
                  setExistingImages(existingImages.filter((i) => i.id !== image.id));
                }}
              >
                <RiDeleteBin3Line className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-box border-2 border-dashed border-base-300 text-base-content/60 hover:border-accent hover:text-accent"
            onClick={handleAddImage}
          >
            <span className="text-xl leading-none">+</span>
            <span className="text-[10px]">Add photo</span>
          </button>
        </div>
        {images.map((name) => (
          <input type="file" key={name} name={name} className="file-input file-input-sm w-full" />
        ))}
      </section>

      <div className={`grid gap-6 p-6 ${coffee ? 'md:grid-cols-[1fr_17rem]' : ''}`}>
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Shop</h3>
            <label className="label text-xs">Name</label>
            <input
              name="shopName"
              className="w-full input"
              placeholder="Starbuck Coffee"
              defaultValue={coffee?.name ?? ''}
            />
            <label className="label mt-1 text-xs">Address</label>
            <textarea
              name="address"
              rows={2}
              className="w-full textarea"
              placeholder="George St. 17"
              defaultValue={coffee?.address ?? ''}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Location &amp; hours</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <div className="flex min-w-0 flex-col gap-2">
                <label className="label text-xs">Lat, Long</label>
                <input
                  name="latLong"
                  className="w-full input"
                  placeholder="-7.55, 110.76"
                  defaultValue={latLongValue}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="label text-xs">Open hours</label>
                <input
                  name="openHours"
                  className="w-full input"
                  placeholder="08:00-17:00"
                  defaultValue={coffee?.open_hours ?? ''}
                />
              </div>
            </div>
          </section>

          <label className="flex cursor-pointer items-center justify-between gap-4 border rounded-box border-base-300 bg-base-100 px-4 py-3">
            <span>
              <span className="block text-sm font-bold">Closed permanently</span>
              <span className="block text-xs text-base-content/60">
                Fades the pin and shows a badge. The review stays.
              </span>
            </span>
            <input
              type="checkbox"
              name="closed"
              className="toggle"
              defaultChecked={coffee?.status === 'closed'}
            />
          </label>
        </div>

        {coffee && (
          // A review on mwyndham.dev owns the rating; without one, this form sets it.
          <aside className="flex flex-col gap-3 self-start border rounded-box border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Review</h3>
              <span className="text-[10px] uppercase tracking-wider text-base-content/50">
                mwyndham.dev
              </span>
            </div>
            {coffee.review ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Rating ratingValue={coffee.rating} />
                  <span className="text-xs text-base-content/60">set in the review</span>
                </div>
                <p className="text-xs font-bold line-clamp-2">{coffee.review.title}</p>
                <a
                  className="btn btn-secondary btn-outline btn-sm"
                  target="_blank"
                  href={`https://mwyndham.dev/admin/articles/${coffee.review.slug}/edit`}
                >
                  Edit Review ↗
                </a>
              </>
            ) : (
              <>
                <p className="text-xs text-base-content/60">
                  No review yet. You can still give a quick rating.
                </p>
                <div className="rating rating-half">
                  <input
                    type="radio"
                    name="rating"
                    value={0}
                    className="rating-hidden opacity-0"
                    defaultChecked={!coffee.rating}
                    aria-label="Not rated"
                  />
                  {[...Array(10)].map((_, i) => {
                    const v = (i + 1) / 2;
                    return (
                      <input
                        key={v}
                        type="radio"
                        name="rating"
                        value={v}
                        className={`mask ${i % 2 === 0 ? 'mask-half-1' : 'mask-half-2'} mask-star-2 bg-accent`}
                        aria-label={`${v} star`}
                        defaultChecked={coffee.rating === v}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs self-start px-0 text-base-content/60"
                  onClick={(e) => {
                    const radios = e.currentTarget.form?.elements.namedItem('rating');
                    if (radios instanceof RadioNodeList) radios.value = '0';
                  }}
                >
                  Clear rating
                </button>
                <div className="divider my-0" />
                <a
                  className="btn btn-secondary btn-outline btn-sm"
                  target="_blank"
                  href={`https://mwyndham.dev/admin/articles/new?coffeeId=${coffee.id}`}
                >
                  Write Review ↗
                </a>
                <p className="text-[11px] text-base-content/50">
                  Once a review is published, its rating replaces this one.
                </p>
              </>
            )}
          </aside>
        )}
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-base-300 px-6 py-4">
        {loading && <span className="loading loading-spinner loading-sm mr-auto" />}
        <a href="/" className="btn btn-ghost">
          Cancel
        </a>
        <button className="btn btn-primary min-w-32" onClick={onSubmit}>
          Save
        </button>
      </div>
    </fieldset>
  );
}

const formatDate = (d: string | number | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function SuccessMessage({
  coffeeId,
  editing,
  review,
}: {
  coffeeId: string;
  editing: boolean;
  review: Review | null;
}) {
  return (
    <div className="m-auto flex flex-col gap-4 p-6 shadow-2xl card bg-base-100">
      <div className="">
        {editing
          ? 'Successfully Updated Coffee Place!'
          : 'Successfully Added new Coffee Place!'}
      </div>
      <a href="/" className="btn btn-primary">
        Go to Home
      </a>
      <a
        target="_blank"
        href={
          review
            ? `https://mwyndham.dev/admin/articles/${review.slug}/edit`
            : `https://mwyndham.dev/admin/articles/new?coffeeId=${coffeeId}`
        }
        className="btn btn-secondary btn-outline"
      >
        {review ? 'Edit Review' : 'Write Review'}
      </a>
    </div>
  );
}
