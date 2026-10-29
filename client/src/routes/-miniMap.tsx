import { RMap, RMarker } from 'maplibre-react-components';
import { useDarkMode } from './-mapLayers.tsx';
import { addGrain, usePrintedStyle } from './-mapStyle.ts';
import { Stamp } from './-mapLayers/-coffeeMarker.tsx';

// Stands in for photos: the shop's real surroundings, not a stock image.
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const style = usePrintedStyle(useDarkMode());
  if (!style) return null;
  return (
    <RMap
      key={`${lat},${lng}`}
      className="!h-full w-full"
      mapStyle={style}
      onStyleImageMissing={addGrain}
      initialCenter={[lng, lat]}
      initialZoom={16}
      // The main map, always on screen behind the panel, carries the attribution.
      initialAttributionControl={false}
      initialInteractive={false}
    >
      <RMarker longitude={lng} latitude={lat}>
        <Stamp selected />
      </RMarker>
    </RMap>
  );
}
