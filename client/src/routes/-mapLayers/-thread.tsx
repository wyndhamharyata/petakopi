import { useMap } from 'maplibre-react-components';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LatLng } from '@store/store.ts';

const EDGE = 12;

// The cord from the open ticket's eyelet to its stamp. It sags with its length, and when the
// shop is off screen it runs to the edge and keeps pointing.
export function Thread({ at }: { at: LatLng }) {
  const map = useMap('map-layer');
  const strands = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!map) return;
    // Every frame, because the ticket animates and the map pans; the DOM is only written on change.
    let frame = 0;
    let last = '';
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const eye = document.querySelector('[data-eyelet]')?.getBoundingClientRect();
      const box = map.getContainer().getBoundingClientRect();
      const p = map.project([at[1], at[0]]);
      const clamp = (v: number, max: number) => Math.min(Math.max(v, EDGE), max - EDGE);
      const x2 = clamp(box.left + p.x, innerWidth);
      const y2 = clamp(box.top + p.y, innerHeight);
      let d = '';
      if (eye) {
        const x1 = eye.left + eye.width / 2;
        const y1 = eye.top + eye.height / 2;
        const sag = Math.hypot(x2 - x1, y2 - y1) * 0.18;
        d = `M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`;
      }
      if (d === last) return;
      last = d;
      for (const strand of strands.current?.children ?? []) strand.setAttribute('d', d);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [map, at]);

  return createPortal(
    <svg className="pointer-events-none fixed inset-0 z-[999] size-full" aria-hidden="true">
      <g ref={strands} fill="none" strokeLinecap="round">
        <path stroke="#F6F6F6" strokeWidth={5} opacity={0.8} />
        <path stroke="#FF5A1F" strokeWidth={2.4} />
        <path stroke="#7A1E00" strokeWidth={1} strokeDasharray="1.5 3" opacity={0.8} />
      </g>
    </svg>,
    document.body
  );
}
