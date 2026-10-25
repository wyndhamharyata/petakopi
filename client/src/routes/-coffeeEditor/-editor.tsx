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
          <AddShopForm {...shopProps} />
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
  const [hovered, setHovered] = useState<number | undefined>();
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

  return (
    <fieldset
      className="m-auto flex flex-col gap-2 overflow-y-auto border px-6 pb-6 drop-shadow-2xl rounded-box border-base-300 bg-base-200 fieldset max-h-[84%] lg:max-h-[50%] md:flex-row"
      disabled={loading}
    >
      <legend className="fieldset-legend">
        {coffee ? 'Edit Shop' : 'Add Shop'}
      </legend>

      <div className="flex flex-col gap-1 w-xs">
        <label className="label">Name</label>
        <input
          name="shopName"
          className="w-full input"
          placeholder="Starbuck Coffee"
          defaultValue={coffee?.name ?? ''}
        />

        <label className="mt-2 label">Lat Long</label>
        <input
          name="latLong"
          className="w-full input"
          placeholder="-7.55, 110.76"
          defaultValue={latLongValue}
        />

        <label className="mt-2 label">Open Hours</label>
        <input
          name="openHours"
          className="w-full input"
          placeholder="08:00-17:00"
          defaultValue={coffee?.open_hours ?? ''}
        />

        {coffee && (
          <>
            {/* The review on mwyndham.dev owns the rating; this form owns the shop facts. */}
            <label className="mt-2 label">Review</label>
            <div className="flex flex-col gap-2 border p-3 rounded-box border-base-300 bg-base-100">
              {coffee.review ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Rating ratingValue={coffee.rating} />
                    <span className="text-xs text-base-content/60">
                      set in the review
                    </span>
                  </div>
                  <p className="text-xs font-bold line-clamp-2">
                    {coffee.review.title}
                  </p>
                  <a
                    className="btn btn-secondary btn-outline btn-sm"
                    target="_blank"
                    href={`https://mwyndham.dev/admin/articles/${coffee.review.slug}/edit`}
                  >
                    Edit Review
                  </a>
                </>
              ) : (
                <>
                  <p className="text-xs">No review yet</p>
                  <a
                    className="btn btn-secondary btn-outline btn-sm"
                    target="_blank"
                    href={`https://mwyndham.dev/admin/articles/new?coffeeId=${coffee.id}`}
                  >
                    Write Review
                  </a>
                </>
              )}
            </div>
          </>
        )}

        <label className="mt-2 label">Address</label>
        <textarea
          name="address"
          className="w-full textarea"
          placeholder="George St. 17"
          defaultValue={coffee?.address ?? ''}
        />

        <label className="mt-3 flex w-fit items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="closed"
            className="toggle toggle-sm"
            defaultChecked={coffee?.status === 'closed'}
          />
          Closed permanently
        </label>
      </div>
      <div className="mx-2 divider md:divider-horizontal my-1"></div>
      <div className="flex flex-col gap-2 w-xs md:pt-4">
        {existingImages.length > 0 && (
          <div
            className={`flex flex-row gap-2 overflow-x-scroll px-2 pb-2 mx-2 md:pt-2`}
          >
            {existingImages?.map((image, index) => (
              <div
                key={`horizontal-images-${image.id}`}
                className="h-[80px] w-[80px] shrink-0 relative"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(undefined)}
              >
                <button
                  className={`${
                    index === hovered ? 'block' : 'hidden'
                  } top-0 left-0 right-0 bottom-0 bg-base-content/60 dark:bg-black/80 text-base-100 dark:text-base-content absolute rounded-box flex`}
                  onClick={(e) => {
                    e.preventDefault();
                    onImageRemoved(image.id);
                    setExistingImages([
                      ...existingImages.filter((i) => i.id != image.id),
                    ]);
                  }}
                >
                  <RiDeleteBin3Line className="m-auto w-8 h-8" />
                </button>
                <img
                  src={image.url}
                  alt={image.alt}
                  className="h-[80px] w-[80px] object-cover rounded-box"
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 overflow-x-clip overflow-y-scroll p-2">
          {images.map((name) => (
            <input type="file" key={name} name={name} className="file-input" />
          ))}
          <button className="btn btn-ghost btn-accent" onClick={handleAddImage}>
            + Add Image
          </button>
        </div>

        <div className="mt-auto mb-0 divider" />
        <button className="btn btn-primary" onClick={onSubmit}>
          Submit
        </button>
        {loading && <progress className="progress"></progress>}
      </div>
    </fieldset>
  );
}

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
