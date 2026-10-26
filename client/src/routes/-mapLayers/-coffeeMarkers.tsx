import { useAppStore } from '@store/store.ts';
import type { Coffee } from '@rpcTypes/coffee.ts';
import { RLayer, RSource, useMap } from 'maplibre-react-components';
import { useCallback, useEffect, useMemo } from 'react';
import { CoffeeMarker } from './-coffeeMarker.tsx';
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  PointLike,
} from 'maplibre-gl';

interface MarkerProps {
  data: Coffee[] | undefined;
  hovered: string | undefined;
  setHovered: (id: string | undefined) => void;
  isDark: boolean;
}

// Shops this close together (px) merge into one bubble, up to street zoom.
const CLUSTER_RADIUS = 50;
const CLUSTER_MAX_ZOOM = 14;

const PIN_PATH =
  'M18.364 17.364L12 23.7279L5.63604 17.364C2.12132 13.8492 2.12132 8.15076 5.63604 4.63604C9.15076 1.12132 14.8492 1.12132 18.364 4.63604C21.8787 8.15076 21.8787 13.8492 18.364 17.364ZM12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13Z';

// MapLibre can't read CSS variables or oklch(); paint one pixel to get rgb.
function themeColor(name: string, alpha = 1) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Pins are map images, drawn once per theme; a style switch drops them, so they are re-added.
function addPinImages(map: MapLibreMap) {
  const base = themeColor('--color-base-100');
  const pins = {
    'pin-known': [base, themeColor('--color-accent')],
    'pin-reviewed': [themeColor('--color-primary'), themeColor('--color-base-content')],
  };
  const ratio = 2;
  for (const [id, [fill, stroke]] of Object.entries(pins)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${40 * ratio}" height="${40 * ratio}" viewBox="-1 -1 26 26"><path d="${PIN_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/></svg>`;
    const img = new Image();
    img.onload = () => {
      if (map.hasImage(id)) map.removeImage(id);
      map.addImage(id, img, { pixelRatio: ratio });
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}

export function CoffeeMarkers({ data, hovered, setHovered, isDark }: MarkerProps) {
  const selectedCoffee = useAppStore((state) => state.selectedCoffee);
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const collapse = useAppStore((state) => state.collapsed);

  const map = useMap('map-layer');

  const byId = useMemo(() => new Map(data?.map((c) => [c.id, c]) ?? []), [data]);

  const geojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: (data ?? []).map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: { id: c.id, status: c.status },
      })),
    }),
    [data]
  );

  // Colors follow the daisyUI theme, which changes with dark mode.
  const colors = useMemo(
    () => ({
      bubble: themeColor('--color-base-100', 0.95),
      bubbleText: themeColor('--color-base-content'),
      bubbleRing: themeColor('--color-accent'),
      reviewedRing: themeColor('--color-primary'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark]
  );

  useEffect(() => {
    if (!map) return;
    addPinImages(map);
    const onStyle = () => {
      if (!map.hasImage('pin-known')) addPinImages(map);
    };
    map.on('styledata', onStyle);
    return () => {
      map.off('styledata', onStyle);
    };
  }, [map, isDark]);

  // Center on the visitor once their position arrives; the map has already rendered by then.
  useEffect(() => {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      if (!useAppStore.getState().selectedCoffee) {
        map.flyTo({ center: [p.coords.longitude, p.coords.latitude] });
      }
    });
  }, [map]);

  useEffect(() => {
    if (!selectedCoffee) {
      return;
    }

    const offset: PointLike = collapse ? [0, -200] : [0, 0];

    map?.flyTo({
      offset: offset,
      center: [selectedCoffee.lng, selectedCoffee.lat],
      zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1),
    });
  }, [selectedCoffee, map, collapse]);

  const onClusterClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!map || !feature || feature.geometry.type !== 'Point') return;
      const source = map.getSource<GeoJSONSource>('coffees');
      const zoom = await source?.getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: zoom ?? map.getZoom() + 2,
      });
    },
    [map]
  );

  const onPinClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const coffee = byId.get(e.features?.[0]?.properties.id);
      if (coffee) setSelected(coffee);
    },
    [byId, setSelected]
  );

  const setCursor = (cursor: string) => () => {
    if (map) map.getCanvas().style.cursor = cursor;
  };

  const hoveredCoffee = hovered ? byId.get(hovered) : undefined;

  return (
    <>
      <RSource
        id="coffees"
        type="geojson"
        data={geojson}
        cluster
        clusterRadius={CLUSTER_RADIUS}
        clusterMaxZoom={CLUSTER_MAX_ZOOM}
        clusterProperties={{
          reviewed: ['+', ['case', ['==', ['get', 'status'], 'reviewed'], 1, 0]],
        }}
      />
      <RLayer
        id="coffee-clusters"
        source="coffees"
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': colors.bubble,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 26],
          'circle-stroke-width': 3,
          'circle-stroke-color': [
            'case',
            ['>', ['get', 'reviewed'], 0],
            colors.reviewedRing,
            colors.bubbleRing,
          ],
        }}
        onClick={onClusterClick}
        onMouseEnter={setCursor('pointer')}
        onMouseLeave={setCursor('')}
      />
      <RLayer
        id="coffee-cluster-count"
        source="coffees"
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['sono'],
          'text-size': 13,
          'text-allow-overlap': true,
        }}
        paint={{ 'text-color': colors.bubbleText }}
      />
      <RLayer
        id="coffee-pins"
        source="coffees"
        type="symbol"
        filter={['!', ['has', 'point_count']]}
        layout={{
          'icon-image': ['match', ['get', 'status'], 'reviewed', 'pin-reviewed', 'pin-known'],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'symbol-sort-key': ['match', ['get', 'status'], 'reviewed', 1, 0],
        }}
        paint={{ 'icon-opacity': ['match', ['get', 'status'], 'closed', 0.4, 1] }}
        onClick={onPinClick}
        onMouseMove={(e: MapLayerMouseEvent) => {
          setCursor('pointer')();
          setHovered(e.features?.[0]?.properties.id);
        }}
        onMouseLeave={() => {
          setCursor('')();
          setHovered(undefined);
        }}
      />
      {/* Only the selected and hovered shops are HTML markers, drawn above every pin. */}
      {selectedCoffee && <CoffeeMarker coffee={selectedCoffee} isSelected />}
      {hoveredCoffee && hoveredCoffee.id !== selectedCoffee?.id && (
        <CoffeeMarker coffee={hoveredCoffee} isSelected={false} showCard />
      )}
    </>
  );
}
