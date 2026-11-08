import { RMap, RMarker } from 'maplibre-react-components';
import { useState } from 'react';
import { useDarkMode } from './-mapLayers.tsx';
import { TILE_URL_DARK, TILE_URL_LIGHT, addGrain } from './-mapStyle.ts';
import { Stamp } from './-mapLayers/-coffeeMarker.tsx';

// Stands in for photos: the shop's real surroundings, not a stock image.
// It never moves, so once drawn it becomes a picture: a live WebGL map inside the scrolling
// ticket cost every scroll frame on a phone.
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const isDark = useDarkMode();
  const key = `${lat},${lng},${isDark}`;
  const [shot, setShot] = useState<{ key: string; url: string } | null>(null);
  if (shot?.key === key) {
    return (
      <div className="relative grid size-full place-items-center">
        <img className="absolute inset-0 size-full" src={shot.url} alt="" />
        <span className="relative">
          <Stamp selected />
        </span>
      </div>
    );
  }
  return (
    <RMap
      key={key}
      className="!h-full w-full"
      mapStyle={isDark ? TILE_URL_DARK : TILE_URL_LIGHT}
      onStyleImageMissing={addGrain}
      initialCenter={[lng, lat]}
      initialZoom={16}
      // The main map, always on screen behind the panel, carries the attribution.
      initialAttributionControl={false}
      initialInteractive={false}
      // Keeps the last frame readable for the picture.
      initialCanvasContextAttributes={{ preserveDrawingBuffer: true }}
      onIdle={(e) => {
        try {
          setShot({ key, url: e.target.getCanvas().toDataURL() });
        } catch {
          // A tainted canvas cannot be read; the live map stays.
        }
      }}
    >
      <RMarker longitude={lng} latitude={lat}>
        <Stamp selected />
      </RMarker>
    </RMap>
  );
}
