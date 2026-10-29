import { useMap } from 'maplibre-react-components';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LatLng } from '@store/store.ts';

const EDGE = 12;
const SAG = 0.16;
const MAX_SAG = 80;
const HEAD = 9;

// The cord from a ticket's eyelet (or a stub, faintly) to its stamp. It sags with its length;
// when the shop is off screen it runs to the edge and an arrowhead points on.
export function Thread({
  at,
  from = '[data-eyelet]',
  faint = false,
}: {
  at: LatLng;
  from?: string;
  faint?: boolean;
}) {
  const map = useMap('map-layer');
  const strands = useRef<SVGGElement>(null);
  const head = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!map) return;
    // Every frame, because the ticket animates and the map pans; the DOM is only written on change.
    let frame = 0;
    let last = '';
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const eye = document.querySelector(from)?.getBoundingClientRect();
      const box = map.getContainer().getBoundingClientRect();
      const p = map.project([at[1], at[0]]);
      const tx = box.left + p.x;
      const ty = box.top + p.y;
      const x2 = Math.min(Math.max(tx, EDGE), innerWidth - EDGE);
      const y2 = Math.min(Math.max(ty, EDGE), innerHeight - EDGE);
      let d = '';
      let arrow = '';
      if (eye) {
        const x1 = eye.left + eye.width / 2;
        const y1 = eye.top + eye.height / 2;
        const sag = Math.min(Math.hypot(x2 - x1, y2 - y1) * SAG, MAX_SAG);
        d = `M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`;
        if (x2 !== tx || y2 !== ty) {
          const a = Math.atan2(ty - y2, tx - x2);
          const point = (r: number, t: number) => `${x2 + r * Math.cos(a + t)} ${y2 + r * Math.sin(a + t)}`;
          arrow = `M${point(HEAD, 0)}L${point(HEAD, 2.5)}L${point(HEAD, -2.5)}Z`;
        }
      }
      if (d + arrow === last) return;
      last = d + arrow;
      for (const strand of strands.current?.children ?? []) strand.setAttribute('d', d);
      head.current?.setAttribute('d', arrow);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [map, at, from]);

  return createPortal(
    <svg
      className="pointer-events-none fixed inset-0 z-[999] size-full"
      style={{ opacity: faint ? 0.35 : 1 }}
      aria-hidden="true"
    >
      <g ref={strands} fill="none" strokeLinecap="round">
        <path stroke="#F6F6F6" strokeWidth={5} opacity={0.8} />
        <path stroke="#FF5A1F" strokeWidth={2.4} />
        <path stroke="#7A1E00" strokeWidth={1} strokeDasharray="1.5 3" opacity={0.8} />
      </g>
      <path ref={head} fill="#FF5A1F" stroke="#F6F6F6" strokeWidth={1.5} />
    </svg>,
    document.body
  );
}
