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
  const [hoursUnknown, setHoursUnknown] = useState(
    !!coffee && !coffee.open_hours
  );
  const [latLong, setLatLong] = useState(
    draft ? `${draft[0]}, ${draft[1]}` : ''
  );
  const [dirty, setDirty] = useState(false);
  const [phase, setPhase] = useState<
    'idle' | 'saving' | 'printing' | 'done' | 'failed'
  >('idle');
  const [progress, setProgress] = useState(0);
  const [photo, setPhoto] = useState({ n: 1, total: 0 });
  const [sentCount, setSentCount] = useState(0);
  const [timedFrom, setTimedFrom] = useState(0);
  const [retryLeft, setRetryLeft] = useState(0);
  const [torn, setTorn] = useState(false);
  const [failedIn, setFailedIn] = useState<'row' | 'data' | 'photo'>('row');
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  // The row is written once; photos that landed stay landed across a retry.
  const savedId = useRef<string | null>(coffee?.id ?? null);
  const rowReady = useRef(false);
  const rowChanged = useRef(true);
  const confirmed = useRef(new Set<string>());
  const lastBytes = useRef(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const left = useRef(false);
  const busy = phase === 'saving' || phase === 'printing' || phase === 'done';

  // The bar's seconds: the shop row's wait, then a stalled or unanswered photo.
  useEffect(() => {
    if (phase !== 'saving' && phase !== 'printing') return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (phase === 'printing')
        setTimedFrom((from) => {
          if (from) return from;
          return Date.now() - lastBytes.current > 10000
            ? lastBytes.current
            : 0;
        });
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => () => xhrRef.current?.abort(), []);

  // A tab close mid-upload would leave the shop without its photos.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [busy]);

  const clock = (from: number) => {
    const s = from ? Math.max(0, Math.floor((now - from) / 1000)) : 0;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

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
    if (busy) {
      if (!confirm('A save is still printing. Leave anyway?')) return;
      left.current = true;
      xhrRef.current?.abort();
      stopEdit();
      return;
    }
    if (dirty && !confirm('Discard changes?')) return;
    stopEdit();
  };

  const touch = () => {
    setDirty(true);
    rowChanged.current = true;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const uploadPhoto = (
    id: string,
    file: File,
    onBytes: (loaded: number) => void
  ) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('PUT', `${import.meta.env.VITE_FETCHER_URL}/api/coffees/images`);
      xhr.withCredentials = true;
      xhr.timeout = 60000;
      xhr.upload.onprogress = (e) => onBytes(e.loaded);
      xhr.onload = () => {
        if (xhrRef.current === xhr) xhrRef.current = null;
        let body: { success?: boolean } | null = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && body?.success) resolve();
        else reject(new Error('The photo could not be saved.'));
      };
      xhr.onerror = () => {
        if (xhrRef.current === xhr) xhrRef.current = null;
        reject(new Error('The photo could not be saved.'));
      };
      xhr.ontimeout = () => {
        if (xhrRef.current === xhr) xhrRef.current = null;
        reject(new Error('The photo upload timed out.'));
      };
      const form = new FormData();
      form.append('id', id);
      form.append('file', file);
      xhr.send(form);
    });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(formRef.current!);
    const openAt = String(form.get('open') ?? '');
    const closeAt = String(form.get('close') ?? '');
    const parsed = safeParse(ModifyCoffeeSchema, {
      shopName: String(form.get('shopName')).trim(),
      address: String(form.get('address')).trim(),
      latLong,
      // Empty times mean unknown, even with the box unticked.
      openHours:
        hoursUnknown || !openAt || !closeAt ? '' : `${openAt}-${closeAt}`,
      closed: form.get('closed') === 'on',
      rating: form.has('rating') ? Number(form.get('rating')) : undefined,
    });
    if (!parsed.success) return setError(parsed.issues[0].message);

    const queue = files
      .filter((f) => !confirmed.current.has(f.url))
      .map(({ file, url }) => ({ file, url }));
    const bytes = queue.reduce((n, f) => n + f.file.size, 0);
    let doneBytes = 0;
    let sent = 0;
    let printing = false;
    let lastPct = 0;

    setError('');
    setRetryLeft(0);
    setTorn(false);
    setProgress(0);
    setSentCount(0);
    setPhoto({ n: 1, total: queue.length });

    try {
      // The row and its photo deletions/order are one data wait. A retry that
      // only has photos left skips them, so an added shop is never posted twice.
      if (rowChanged.current) {
        setPhase('saving');
        setTimedFrom(Date.now());
        const id = savedId.current;
        const res = id
          ? await client.api.coffees[':id'].update.$post({
              json: parsed.output,
              param: { id },
            })
          : coffee
            ? await client.api.coffees[':id'].update.$post({
                json: parsed.output,
                param: { id: coffee.id },
              })
            : await client.api.coffees.$post({ json: parsed.output });
        const body = res.ok ? await res.json() : null;
        if (!body?.success) throw new Error('The shop could not be saved.');
        savedId.current = body.id;
        rowReady.current = true;

        for (const imageId of removed) {
          await client.api.coffees.images[':id'].$delete({
            param: { id: imageId },
          });
        }
        // Before uploads, which append after the saved order.
        if (images.length > 0) {
          await client.api.coffees.images.order.$post({
            json: { coffeeId: body.id, ids: images.map((i) => i.id) },
          });
        }
        rowChanged.current = false;
      }

      // Leaving during the row wait stops the photos from starting.
      if (left.current) return;

      if (queue.length > 0) {
        setPhase('printing');
        setTimedFrom(0);
        lastBytes.current = Date.now();
        printing = true;
        for (const [i, item] of queue.entries()) {
          if (left.current) return;
          setPhoto({ n: i + 1, total: queue.length });
          await uploadPhoto(savedId.current!, item.file, (loaded) => {
            lastBytes.current = Date.now();
            lastPct = Math.min(95, ((doneBytes + loaded) / bytes) * 100);
            setProgress(lastPct);
            setTimedFrom(doneBytes + loaded >= bytes ? Date.now() : 0);
          });
          doneBytes += item.file.size;
          sent += 1;
          confirmed.current.add(item.url);
          setSentCount(sent);
          lastPct = Math.min(95, (doneBytes / bytes) * 100);
          setProgress(lastPct);
        }
      }

      setProgress(100);
      setSentCount(sent);
      setPhase('done');
      setTimedFrom(0);

      await Promise.all([
        mutate('coffees'),
        mutate('latestReviews'),
        mutate(`imageData:${savedId.current}`),
      ]);
      const { coffee: saved } = await rpcFetch(
        client.api.coffees[':id'].$get
      )({ param: { id: savedId.current! } })();
      // The printed tape holds for a beat, then the nota drains to mint.
      await new Promise((r) => setTimeout(r, 300));
      const paper = formRef.current?.closest('.nota');
      if (paper && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        paper.classList.add('drain');
        await new Promise((r) => setTimeout(r, 500));
      }
      stopEdit();
      if (saved) setSelected(saved, true);
    } catch (err) {
      setPhase('failed');
      setProgress(lastPct);
      setTorn(printing);
      setFailedIn(printing ? 'photo' : rowReady.current ? 'data' : 'row');
      setTimedFrom(0);
      setRetryLeft(
        printing
          ? files.filter((f) => !confirmed.current.has(f.url)).length
          : 0
      );
      setError(err instanceof Error ? err.message : 'Saving failed.');
    }
  };

  const ratingOwnedByReview = !!coffee?.review;

  const barLabel =
    phase === 'saving'
      ? 'SAVING'
      : phase === 'printing'
        ? photo.total > 1
          ? `PHOTO ${photo.n} OF ${photo.total}`
          : 'PHOTO'
        : phase === 'done'
          ? 'PRINTED'
          : phase === 'failed'
            ? failedIn === 'row'
              ? 'SHOP NOT SAVED'
              : failedIn === 'data'
                ? 'SHOP SAVED'
                : `PHOTO ${photo.n} FAILED`
            : '';
  const barValue =
    phase === 'saving'
      ? clock(timedFrom)
      : phase === 'printing'
        ? timedFrom
          ? clock(timedFrom)
          : `${Math.round(progress)}%`
        : phase === 'done'
          ? sentCount > 0
            ? `${sentCount} ${sentCount === 1 ? 'PHOTO' : 'PHOTOS'}`
            : 'SAVED'
          : phase === 'failed' && failedIn === 'photo'
            ? `${sentCount} SENT`
            : '—';

  const keys = (
    <div className="flex flex-1 gap-2">
      <button
        type="button"
        className="key min-h-12 flex-1 lg:min-h-10"
        onClick={cancel}
        disabled={busy}
      >
        Cancel
      </button>
      {/* form=: on a phone this key is portalled out of the form, onto the till. */}
      <button
        type="submit"
        form="nota-form"
        className={`key key-signal min-h-12 flex-1 lg:min-h-10 ${busy ? 'down' : ''}`}
        aria-disabled={busy || undefined}
      >
        {phase === 'saving'
          ? 'Saving…'
          : phase === 'printing'
            ? `Printing ${photo.n}/${photo.total}…`
            : retryLeft > 0
              ? `Retry ${retryLeft} ${retryLeft === 1 ? 'photo' : 'photos'}`
              : 'Save'}
      </button>
    </div>
  );

  const isClosed = coffee?.status === 'closed';

  return (
    <form
      ref={formRef}
      id="nota-form"
      onSubmit={save}
      onChange={touch}
      aria-busy={busy || undefined}
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
        disabled={busy}
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
                  touch();
                }}
              >
                <img src={image.url} alt={image.alt} className="size-full object-cover" />
              </button>
              {index === 0 && <span className="film-edge">Cover</span>}
              <RemoveFrame
                onClick={() => {
                  setRemoved([...removed, image.id]);
                  setImages(images.filter((i) => i.id !== image.id));
                  touch();
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
                  touch();
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
                const all = [...(e.target.files ?? [])];
                const picked = all
                  .filter((file) => file.size > 0 && file.type.startsWith('image/'))
                  .map((file) => ({ file, url: URL.createObjectURL(file) }));
                if (picked.length < all.length)
                  setError('Only images can be added.');
                setFiles([...files, ...picked]);
                touch();
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

        {!ratingOwnedByReview && (
          // Without a review, this is my rating; a published review replaces it.
          // A new shop has no review yet, so it gets the cup card too.
          <Field label="My rating">
            <CupsInput
              initial={coffee?.rating ?? 0}
              onChange={touch}
            />
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

      <div className="shrink-0 px-4 py-1">
        <SaveBar
          phase={phase}
          progress={progress}
          label={barLabel}
          value={barValue}
          torn={torn}
        />
      </div>

      {(desktop || error) && (
        <div className="tear-line flex shrink-0 flex-col gap-2 p-3">
          {error && <p className="err">× {error}</p>}
          {desktop && keys}
        </div>
      )}
      {/* On a phone the keys sit on the till, above the keyboard. */}
      {!desktop && tillSlot && createPortal(keys, tillSlot)}
    </form>
  );
}

function SaveBar({
  phase,
  progress,
  label,
  value,
  torn,
}: {
  phase: 'idle' | 'saving' | 'printing' | 'done' | 'failed';
  progress: number;
  label: string;
  value: string;
  torn: boolean;
}) {
  const waiting = phase === 'saving';
  const live = phase !== 'idle';
  return (
    <div className="busy" data-mode={waiting ? 'wait' : 'print'}>
      {live && (
        <div className="busy-row">
          <span aria-live="polite">{label}</span>
          <i className="leader" />
          <b>{value}</b>
        </div>
      )}
      <div
        className="busy-slot"
        role={live ? 'progressbar' : undefined}
        aria-label={
          live
            ? waiting
              ? 'Saving shop'
              : phase === 'done'
                ? 'Photos printed'
                : phase === 'failed'
                  ? 'Save failed'
                  : 'Uploading photos'
            : undefined
        }
        aria-valuemin={live ? 0 : undefined}
        aria-valuemax={live ? 100 : undefined}
        aria-valuenow={
          phase === 'printing' || phase === 'done' || phase === 'failed'
            ? Math.round(progress)
            : undefined
        }
      >
        <div className="busy-roll">
          <span
            className="busy-band"
            style={waiting ? undefined : { width: `${progress}%` }}
          />
          {torn && (
            <span className="busy-torn" style={{ left: `${progress}%` }} />
          )}
        </div>
        {live && (
          <span
            className="busy-head"
            style={waiting ? undefined : { left: `${progress}%` }}
          />
        )}
      </div>
    </div>
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
