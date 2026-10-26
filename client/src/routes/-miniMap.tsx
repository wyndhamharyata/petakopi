import { RMap, RMarker } from 'maplibre-react-components';
import { RiMapPin2Fill } from 'react-icons/ri';
import { TILE_URL_DARK, TILE_URL_LIGHT, useDarkMode } from './-mapLayers.tsx';

// Stands in for photos: the shop's real surroundings, not a stock image.
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const isDark = useDarkMode();
  return (
    <RMap
      key={`${lat},${lng}`}
      className="!h-full w-full"
      mapStyle={isDark ? TILE_URL_DARK : TILE_URL_LIGHT}
      initialCenter={[lng, lat]}
      initialZoom={16}
      // The main map, always on screen behind the panel, carries the attribution.
      initialAttributionControl={false}
      initialInteractive={false}
    >
      <RMarker longitude={lng} latitude={lat} initialAnchor="bottom">
        <RiMapPin2Fill className="fill-primary stroke-base-100 text-[40px]" strokeWidth={1.7} />
      </RMarker>
    </RMap>
  );
}
