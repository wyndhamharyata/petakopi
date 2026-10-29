import { type FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { safeParse } from 'valibot';
import { type Coffee, ModifyCoffeeSchema } from '@rpcTypes/coffee.ts';
import type { Image } from '@rpcTypes/image.ts';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { useAppStore } from '@store/store.ts';
import useSWR, { mutate } from 'swr';
import { useDesktop } from '../-util.ts';
import { RiAddLine, RiCloseLine } from 'react-icons/ri';

type EditableCoffee = Coffee & {
  review?: { slug: string; title: string } | null;
};

// Edits the selected shop in place, or adds a new one when `coffee` is undefined.
export function Editor({ coffee }: { coffee?: EditableCoffee }) {
  const draft = useAppStore((state) => state.draft);
  const draftName = useAppStore((state) => state.draftName);
  const setDraft = useAppStore((state) => state.setDraft);
  const stopEdit = useAppStore((state) => state.stopEdit);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const desktop = useDesktop();
  const dragging = useAppStore((state) => state.dragging);
  // The phone till renders its slot in the same commit as this form, so it is found after mount.
  const [tillSlot, setTillSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setTillSlot(document.getElementById('till-slot')), []);

  const { data: savedImages } = useSWR(
    coffee ? `imageData:${coffee.id}` : null,
    rpcFetch(client.api.coffees.images[':id'].$get)({
      param: { id: coffee?.id ?? '' },
    }),
    { dedupingInterval: 300000 }
  );
  const [images, setImages] = useState<Image[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  useEffect(() => setImages(savedImages ?? []), [savedImages]);

  const [open, close] = coffee?.open_hours
    ? coffee.open_hours.split('-')
    : ['', ''];
  const [hoursUnknown, setHoursUnknown] = useState(!coffee?.open_hours);
  const [latLong, setLatLong] = useState(
    draft ? `${draft[0]}, ${draft[1]}` : ''
  );
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
      if (coffee && (draft[0] !== coffee.lat || draft[1] !== coffee.lng))
        setDirty(true);
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
        const up = await client.api.coffees.images.$put({
          form: { id: body.id, file },
        });
        if (!up.ok)
          throw new Error(`Saved, but uploading ${file.name} failed.`);
      }

      await Promise.all([
        mutate('coffees'),
        mutate('latestReviews'),
        mutate(`imageData:${body.id}`),
      ]);
      const { coffee: saved } = await rpcFetch(client.api.coffees[':id'].$get)({
        param: { id: body.id },
      })();
      // The nota lifts and drains to mint, then it is the ticket again, already hanging.
      const paper = formRef.current?.closest('.nota');
      if (paper && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        paper.classList.add('drain');
        await new Promise((r) => setTimeout(r, 500));
      }
      stopEdit();
      if (saved) setSelected(saved, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed.');
    } finally {
      setSaving(false);
    }
  };

  const ratingOwnedByReview = !!coffee?.review;

  const keys = (
    <div className="flex flex-1 gap-2">
      <button type="button" className="key min-h-12 flex-1 lg:min-h-10" onClick={cancel} disabled={saving}>
        Cancel
      </button>
      {/* form=: on a phone this key is portalled out of the form, onto the till. */}
      <button type="submit" form="nota-form" className="key key-signal min-h-12 flex-1 lg:min-h-10" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );

  const isClosed = coffee?.status === 'closed';

  return (
    <form
      ref={formRef}
      id="nota-form"
      onSubmit={save}
      onChange={() => setDirty(true)}
      // On a phone the sheet is the slip.
      className={`flex min-h-0 flex-1 flex-col ${desktop ? 'nota' : ''}`}
    >
      <span className="hold max-lg:hidden" />
      <span className="eyelet" data-eyelet />
      <header className="flex shrink-0 items-start gap-2.5 px-4 pt-7 pb-3">
        <h2 className="flex-1 font-display text-[30px] leading-[0.94] font-black uppercase text-balance lg:text-[34px]">
          {coffee ? `Edit ${coffee.name}` : 'Add a shop'}
        </h2>
        <button
          type="button"
          className="key key-sm w-8 px-0"
          onClick={cancel}
          title="Cancel (Esc)"
          aria-label="Cancel"
        >
          <RiCloseLine size={18} />
        </button>
      </header>

      {/* min-w-0: a fieldset defaults to min-content width, so the film strip widened the form. */}
      <fieldset
        disabled={saving}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 [&>*]:shrink-0"
      >
        <div className="contact">
          {images.map((image, index) => (
            <div key={image.id} className={`frame ${index === 0 ? 'cover' : ''}`}>
              <button
                type="button"
                aria-label={index === 0 ? 'Cover photo' : 'Make cover'}
                title={index === 0 ? 'Cover photo' : 'Make cover'}
                className="size-full cursor-pointer"
                onClick={() => {
                  setImages([image, ...images.filter((i) => i.id !== image.id)]);
                  setDirty(true);
                }}
              >
                <img src={image.url} alt={image.alt} className="size-full object-cover" />
              </button>
              {index === 0 && <span className="film-edge">Cover</span>}
              <RemoveFrame
                onClick={() => {
                  setRemoved([...removed, image.id]);
                  setImages(images.filter((i) => i.id !== image.id));
                  setDirty(true);
                }}
              />
            </div>
          ))}
          {files.map(({ file, url }) => (
            <div key={url} className="frame">
              <img src={url} alt={file.name} className="size-full object-cover opacity-80" />
              <span className="film-edge">New</span>
              <RemoveFrame
                onClick={() => {
                  URL.revokeObjectURL(url);
                  setFiles(files.filter((f) => f.url !== url));
                }}
              />
            </div>
          ))}
          <label className="frame grid cursor-pointer place-items-center text-center text-[13px] font-bold text-[#E6E6E6] outline-dashed outline-[1.5px] outline-[#8A8A8A] hover:outline-[var(--marker)]">
            <span>
              <RiAddLine size={18} className="mx-auto" />
              Add photo
            </span>
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

        <Field label="Name" htmlFor="f-name">
          <input
            id="f-name"
            name="shopName"
            className="line"
            defaultValue={coffee?.name ?? draftName}
            placeholder="Kopi Nusantara"
            autoFocus={!coffee}
          />
        </Field>

        <Field label="Address" htmlFor="f-address">
          <textarea
            id="f-address"
            name="address"
            rows={2}
            className="line"
            defaultValue={coffee?.address ?? ''}
            placeholder="Street, area, city"
          />
        </Field>

        <Field label="Hours">
          <div className="flex flex-wrap items-center gap-2">
            <input type="time" name="open" className="time" defaultValue={open} disabled={hoursUnknown} aria-label="Opens" />
            <span>–</span>
            <input type="time" name="close" className="time" defaultValue={close} disabled={hoursUnknown} aria-label="Closes" />
            <label className="ml-1 inline-flex min-h-9 cursor-pointer items-center gap-2 text-[14px] font-semibold">
              <input
                type="checkbox"
                className="box"
                checked={hoursUnknown}
                onChange={(e) => setHoursUnknown(e.target.checked)}
              />
              Unknown
            </label>
          </div>
        </Field>

        <Field label="Location" htmlFor="f-location">
          <input
            id="f-location"
            className={`line ${dragging ? 'border-b-[3px]! bg-white/35!' : ''}`}
            value={latLong}
            placeholder="-7.55, 110.77"
            onChange={(e) => {
              setLatLong(e.target.value);
              const [lat, lng] = e.target.value.split(',').map(Number);
              if (Number.isFinite(lat) && Number.isFinite(lng)) setDraft([lat, lng]);
            }}
          />
        </Field>

        {coffee && !ratingOwnedByReview && (
          // Without a review, this is my rating; a published review replaces it.
          <Field label="My rating">
            <CupsInput initial={coffee.rating} onChange={() => setDirty(true)} />
          </Field>
        )}

        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 border-y-[1.5px] border-[#141414] py-1.5 text-[15px] font-semibold">
          Closed permanently
          <input type="checkbox" name="closed" className="peer sr-only" defaultChecked={isClosed} />
          <span className="closed-well grid h-10 w-[118px] place-items-center border-[1.5px] border-dashed border-[#141414]/50 peer-checked:border-transparent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-[#141414]">
            <span className="stamp stamp-ink stamp-lg stamp-in [--r:-6deg]">Closed</span>
          </span>
        </label>
      </fieldset>

      {(desktop || error) && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-dashed border-[#141414]/40 p-3">
          {error && <p className="err">× {error}</p>}
          {desktop && keys}
        </div>
      )}
      {/* On a phone the keys sit on the till, above the keyboard. */}
      {!desktop && tillSlot && createPortal(keys, tillSlot)}
    </form>
  );
}

function RemoveFrame({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remove photo"
      className="absolute top-0 right-0 grid size-6 cursor-pointer place-items-center bg-[#F6F6F6] text-[#141414] hover:bg-[#141414] hover:text-[#F6F6F6]"
      onClick={onClick}
    >
      <RiCloseLine size={14} />
    </button>
  );
}

// Five cups; the left half of a cup sets .5. Submitted as "rating", 0 when cleared.
function CupsInput({ initial, onChange }: { initial: number; onChange: () => void }) {
  const [rating, setRating] = useState(initial);
  const set = (v: number) => {
    setRating(v);
    onChange();
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="rating" value={rating} />
      <span className="cups" role="radiogroup" aria-label="My rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <i
            key={n}
            className={`size-[30px]! ${rating >= n ? 'f' : rating >= n - 0.5 ? 'h' : ''}`}
          >
            {[n - 0.5, n].map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={rating === v}
                aria-label={`${v} cups`}
                className={`absolute inset-y-0 z-[1] w-1/2 cursor-pointer ${v === n ? 'right-0' : 'left-0'}`}
                onClick={() => set(v)}
              />
            ))}
          </i>
        ))}
      </span>
      <b className="font-mono text-[15px]">{rating ? rating.toFixed(1) : '–'}</b>
      <button type="button" className="key key-sm" onClick={() => set(0)}>
        Clear
      </button>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[14px] font-bold">
          {label}
        </label>
      ) : (
        <span className="text-[14px] font-bold">{label}</span>
      )}
      {children}
    </div>
  );
}
