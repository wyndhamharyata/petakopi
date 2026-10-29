import { RMap } from 'maplibre-react-components';
import useSWR from 'swr';
import { client, rpcFetch } from '@fetcher/fetcher.ts';
import { useEffect, useState } from 'react';
import { CoffeeMarkers } from './-mapLayers/-coffeeMarkers.tsx';
import { TILE_URL_DARK, TILE_URL_LIGHT, addGrain } from './-mapStyle.ts';

export const DEFAULT_CENTER: [number, number] = [-7.5603894, 110.771847];

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setIsDarkMode(mediaQuery.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isDarkMode;
}

export function MapLayers() {
  const [hovered, setHovered] = useState<string | undefined>();

  const { data } = useSWR('coffees', rpcFetch(client.api.coffees.$get)({}), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 minute
  });

  const isDark = useDarkMode();

  return (
    <div className="h-full w-full">
      <RMap
        id="map-layer"
        className="!h-full w-full bg-[#D6D6D6] dark:bg-[#262626]"
        mapStyle={isDark ? TILE_URL_DARK : TILE_URL_LIGHT}
        onStyleImageMissing={addGrain}
        initialCenter={[DEFAULT_CENTER[1], DEFAULT_CENTER[0]]}
        initialZoom={13}
      >
        <CoffeeMarkers data={data} hovered={hovered} setHovered={setHovered} isDark={isDark} />
      </RMap>
    </div>
  );
}
