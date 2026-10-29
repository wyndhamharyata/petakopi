import { useMap } from 'maplibre-react-components';
import type { MapMouseEvent } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// While adding a shop the pointer becomes plotter hairlines with a live coordinate readout.
export function Plotter() {
  const map = useMap('map-layer');
  const [at, setAt] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map) return;
    const onMove = (e: MapMouseEvent) => {
      const box = map.getContainer().getBoundingClientRect();
      setAt({ x: box.left + e.point.x, y: box.top + e.point.y, lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    const onOut = () => setAt(null);
    map.on('mousemove', onMove);
    map.on('mouseout', onOut);
    return () => {
      map.off('mousemove', onMove);
      map.off('mouseout', onOut);
    };
  }, [map]);

  if (!at) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[998]" aria-hidden="true">
      <span className="absolute inset-y-0 w-px bg-[#141414]" style={{ left: at.x }} />
      <span className="absolute inset-x-0 h-px bg-[#141414]" style={{ top: at.y }} />
      <span className="tag absolute" style={{ left: at.x + 10, top: at.y + 10 }}>
        {at.lat.toFixed(6)}, {at.lng.toFixed(6)}
      </span>
    </div>,
    document.body
  );
}
