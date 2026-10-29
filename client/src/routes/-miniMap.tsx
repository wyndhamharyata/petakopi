import { RMap, RMarker } from 'maplibre-react-components';
import { useDarkMode } from './-mapLayers.tsx';
import { TILE_URL_DARK, TILE_URL_LIGHT, addGrain } from './-mapStyle.ts';
import { Stamp } from './-mapLayers/-coffeeMarker.tsx';

// Stands in for photos: the shop's real surroundings, not a stock image.
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const isDark = useDarkMode();
  return (
    <RMap
      key={`${lat},${lng}`}
      className="!h-full w-full"
      mapStyle={isDark ? TILE_URL_DARK : TILE_URL_LIGHT}
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
