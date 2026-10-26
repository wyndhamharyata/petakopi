import { type FormEvent, useEffect, useRef, useState } from 'react';
import { safeParse } from 'valibot';
import { type Coffee, ModifyCoffeeSchema } from '@rpcTypes/coffee.ts';
import type { Image } from '@rpcTypes/image.ts';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { useAppStore } from '@store/store.ts';
import useSWR, { mutate } from 'swr';
import { RiAddLine, RiArrowLeftSLine, RiCloseLine } from 'react-icons/ri';

type EditableCoffee = Coffee & { review?: { slug: string; title: string } | null };

// Edits the selected shop in place, or adds a new one when `coffee` is undefined.
export function Editor({ coffee }: { coffee?: EditableCoffee }) {
  const draft = useAppStore((state) => state.draft);
  const setDraft = useAppStore((state) => state.setDraft);
  const stopEdit = useAppStore((state) => state.stopEdit);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);

  const { data: savedImages } = useSWR(
    coffee ? `imageData:${coffee.id}` : null,
    rpcFetch(client.api.coffees.images[':id'].$get)({ param: { id: coffee?.id ?? '' } }),
    { dedupingInterval: 300000 }
  );
  const [images, setImages] = useState<Image[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  useEffect(() => setImages(savedImages ?? []), [savedImages]);

  const [open, close] = coffee?.open_hours ? coffee.open_hours.split('-') : ['', ''];
  const [hoursUnknown, setHoursUnknown] = useState(!coffee?.open_hours);
  const [latLong, setLatLong] = useState(draft ? `${draft[0]}, ${draft[1]}` : '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // The map pin moved: follow it, unless this field is what moved it.
  useEffect(() => {
    if (!draft) return;
    const [lat, lng] = latLong.split(',').map(Number);
    if (lat !== draft[0] || lng !== draft[1]) {
      setLatLong(`${draft[0].toFixed(6)}, ${draft[1].toFixed(6)}`);
      if (coffee && (draft[0] !== coffee.lat || draft[1] !== coffee.lng)) setDirty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const cancel = () => {
    if (dirty && !confirm('Discard changes?')) return;
    stopEdit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData(formRef.current!);
    const parsed = safeParse(ModifyCoffeeSchema, {
      shopName: String(form.get('shopName')).trim(),
      address: String(form.get('address')).trim(),
      latLong,
      openHours: hoursUnknown ? '' : `${form.get('open')}-${form.get('close')}`,
      closed: form.get('closed') === 'on',
      rating: form.has('rating') ? Number(form.get('rating')) : undefined,
    });
    if (!parsed.success) return setError(parsed.issues[0].message);

    setSaving(true);
    setError('');
    try {
      const res = coffee
        ? await client.api.coffees[':id'].update.$post({
            json: parsed.output,
            param: { id: coffee.id },
          })
        : await client.api.coffees.$post({ json: parsed.output });
      const body = res.ok ? await res.json() : null;
      if (!body?.success) throw new Error('The shop could not be saved.');

      // Photo steps after the shop row: a failed photo shouldn't lose the shop's edits.
      for (const id of removed) {
        await client.api.coffees.images[':id'].$delete({ param: { id } });
      }
      // Before uploads, which append after the saved order.
      if (images.length > 0) {
        await client.api.coffees.images.order.$post({
          json: { coffeeId: body.id, ids: images.map((i) => i.id) },
        });
      }
      for (const { file } of files) {
        const up = await client.api.coffees.images.$put({ form: { id: body.id, file } });
        if (!up.ok) throw new Error(`Saved, but uploading ${file.name} failed.`);
      }

      await Promise.all([
        mutate('coffees'),
        mutate('latestReviews'),
        mutate(`imageData:${body.id}`),
      ]);
      const { coffee: saved } = await rpcFetch(client.api.coffees[':id'].$get)({
        param: { id: body.id },
      })();
      stopEdit();
      if (saved) setSelected(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed.');
    } finally {
      setSaving(false);
    }
  };

  const ratingOwnedByReview = !!coffee?.review;

  return (
    <form
      ref={formRef}
      onSubmit={save}
      onChange={() => setDirty(true)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center gap-1 border-b border-base-300 px-2 py-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={cancel}
          title="Cancel (Esc)"
          aria-label="Cancel"
        >
          <RiArrowLeftSLine size={22} />
        </button>
        <span className="truncate text-[15px] font-semibold">
          {coffee ? `Edit ${coffee.name}` : 'Add a shop'}
        </span>
      </div>

      <fieldset disabled={saving} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-base-content/60">
              Photos
            </h3>
            {images.length > 1 && (
              <span className="text-[13px] text-base-content/60">Tap a photo to make it the cover</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto p-1 pb-3">
            {images.map((image, index) => (
              <div key={image.id} className="relative size-20 shrink-0">
                <button
                  type="button"
                  aria-label={index === 0 ? 'Cover photo' : 'Make cover'}
                  className={`size-full overflow-hidden rounded-box ${
                    index === 0 ? 'outline-2 outline-offset-2 outline-primary' : ''
                  }`}
                  onClick={() => {
                    setImages([image, ...images.filter((i) => i.id !== image.id)]);
                    setDirty(true);
                  }}
                >
                  <img src={image.url} alt={image.alt} className="size-full object-cover" />
                </button>
                {index === 0 && (
                  <span className="badge badge-primary badge-xs absolute -bottom-2 left-1/2 -translate-x-1/2">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-base-300 bg-base-100 hover:bg-error hover:text-error-content"
                  onClick={() => {
                    setRemoved([...removed, image.id]);
                    setImages(images.filter((i) => i.id !== image.id));
                    setDirty(true);
                  }}
                >
                  <RiCloseLine size={14} />
                </button>
              </div>
            ))}
            {files.map(({ file, url }) => (
              <div key={url} className="relative size-20 shrink-0">
                <img src={url} alt={file.name} className="size-full rounded-box object-cover opacity-80" />
                <span className="badge badge-xs absolute -bottom-2 left-1/2 -translate-x-1/2">New</span>
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-base-300 bg-base-100 hover:bg-error hover:text-error-content"
                  onClick={() => {
                    URL.revokeObjectURL(url);
                    setFiles(files.filter((f) => f.url !== url));
                  }}
                >
                  <RiCloseLine size={14} />
                </button>
              </div>
            ))}
            <label className="flex size-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-box border border-dashed border-base-content/25 text-[13px] text-base-content/60 hover:border-accent hover:text-accent">
              <RiAddLine size={18} />
              Add
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = [...(e.target.files ?? [])].map((file) => ({
                    file,
                    url: URL.createObjectURL(file),
                  }));
                  setFiles([...files, ...picked]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <Field label="Name">
          <input
            name="shopName"
            className="input w-full"
            defaultValue={coffee?.name ?? ''}
            placeholder="Kopi Nusantara"
            autoFocus={!coffee}
          />
        </Field>

        <Field label="Address" hint="optional">
          <textarea
            name="address"
            rows={2}
            className="textarea w-full"
            defaultValue={coffee?.address ?? ''}
            placeholder="Street, area, city"
          />
        </Field>

        <Field label="Hours">
          <div className="flex items-center gap-2">
            <input
              type="time"
              name="open"
              className="input flex-1"
              defaultValue={open}
              disabled={hoursUnknown}
            />
            <span>–</span>
            <input
              type="time"
              name="close"
              className="input flex-1"
              defaultValue={close}
              disabled={hoursUnknown}
            />
          </div>
          <label className="label mt-1 text-[13px]">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={hoursUnknown}
              onChange={(e) => setHoursUnknown(e.target.checked)}
            />
            Unknown
          </label>
        </Field>

        <Field label="Location">
          <input
            className="input w-full font-mono text-[13px]"
            value={latLong}
            placeholder="-7.55, 110.77"
            onChange={(e) => {
              setLatLong(e.target.value);
              const [lat, lng] = e.target.value.split(',').map(Number);
              if (Number.isFinite(lat) && Number.isFinite(lng)) setDraft([lat, lng]);
            }}
          />
          <p className="text-[13px] text-base-content/60">Or drag the pin on the map.</p>
        </Field>

        {coffee && !ratingOwnedByReview && (
          // Without a review, this is my rating; a published review replaces it.
          <Field label="My rating" hint="until a review sets it">
            <div className="flex items-center gap-3">
              <div className="rating rating-half">
                <input
                  type="radio"
                  name="rating"
                  value={0}
                  className="rating-hidden"
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
                      className={`mask mask-star-2 ${i % 2 === 0 ? 'mask-half-1' : 'mask-half-2'} bg-warning`}
                      aria-label={`${v} star`}
                      defaultChecked={coffee.rating === v}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={(e) => {
                  const radios = e.currentTarget.form?.elements.namedItem('rating');
                  if (radios instanceof RadioNodeList) radios.value = '0';
                  setDirty(true);
                }}
              >
                Clear
              </button>
            </div>
          </Field>
        )}
        {ratingOwnedByReview && (
          <p className="text-[13px] text-base-content/60">
            Rating is set by your review, “{coffee?.review?.title}”.
          </p>
        )}

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-field border border-base-300 px-3 py-2">
          <span>
            <span className="block text-[15px]">Closed permanently</span>
            <span className="block text-[13px] text-base-content/60">
              Fades the pin. The review stays.
            </span>
          </span>
          <input
            type="checkbox"
            name="closed"
            className="toggle toggle-sm toggle-error"
            defaultChecked={coffee?.status === 'closed'}
          />
        </label>
      </fieldset>

      <div className="flex flex-col gap-2 border-t border-base-300 p-3">
        {error && <p className="text-[13px] text-error">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={cancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
            {saving && <span className="loading loading-spinner loading-sm" />}
            Save
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="fieldset gap-1 p-0">
      <legend className="fieldset-legend text-[13px]">
        {label}
        {hint && <span className="font-normal text-base-content/60">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}
