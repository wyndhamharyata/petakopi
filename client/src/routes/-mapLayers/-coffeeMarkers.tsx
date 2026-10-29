import { type LatLng, useAppStore } from '@store/store.ts';
import type { Coffee } from '@rpcTypes/coffee.ts';
import { RLayer, RMarker, RSource, useMap } from 'maplibre-react-components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoffeeHoverCard, CoffeeMarker } from './-coffeeMarker.tsx';
import { isDesktop, isTypingTarget, useDesktop } from '../-util.ts';
import { Thread } from './-thread.tsx';
import { Plotter } from './-plotter.tsx';
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  MapMouseEvent,
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
const CLUSTER_RADIUS = 40;
const CLUSTER_MAX_ZOOM = 16;

const NEW_SHOP = { id: 'new', name: 'New shop', status: 'known' } as Coffee;

// Keep the shop clear of the panel: between the receipt and the ticket on desktop, above the sheet on mobile.
function panelOffset(): PointLike {
  const { selectedCoffee, editing } = useAppStore.getState();
  if (isDesktop()) return selectedCoffee || editing ? [0, 0] : [208, 0];
  const sheet = useAppStore.getState().sheet;
  // The till and its slot (about 78px) plus the paper on it.
  const covered = 78 + (sheet === 'peek' ? 74 : window.innerHeight * (sheet === 'half' ? 0.45 : 0.85));
  return [0, -covered / 2];
}

const INK = '#141414';
const THERMAL = '#F6F6F6';
const CHOP = '#B80F2A';
const ROUGH =
  '<filter id="r" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="1.1" xChannelSelector="R" yChannelSelector="G"/></filter>';
const star = (x: number, y: number, w: number) =>
  [50, 0, 61, 35, 98, 35, 68, 57, 79, 91, 50, 70, 21, 91, 32, 57, 2, 35, 39, 35]
    .map((v, i) => (i % 2 ? y : x) + (v / 100) * w)
    .join(' ');

// Stamps, drawn centred in a 44px square so a thumb can take one; clusters are stacks of paper.
const STAMPS: Record<string, [number, string]> = {
  'stamp-known': [
    44,
    `<rect x="16.5" y="16.5" width="13" height="13" fill="${INK}" opacity=".3"/><rect x="16.5" y="16.5" width="11" height="11" fill="${THERMAL}" stroke="${INK}" stroke-width="2"/>`,
  ],
  'stamp-reviewed': [
    44,
    `<g filter="url(#r)"><rect x="11.5" y="11.5" width="21" height="21" fill="${CHOP}"/><polygon points="${star(15, 15, 14)}" fill="${THERMAL}"/></g>`,
  ],
  'stamp-closed': [
    44,
    `<rect x="16.5" y="16.5" width="11" height="11" fill="${THERMAL}" fill-opacity=".55" stroke="${INK}" stroke-opacity=".55" stroke-width="2"/><path d="M18 18l8 8M26 18l-8 8" stroke="${INK}" stroke-opacity=".6" stroke-width="1.5"/>`,
  ],
};
for (const [size, sheets] of [[28, 1], [32, 2], [38, 3]]) {
  const x = 30 - size / 2;
  const stack = [...Array(sheets)]
    .map((_, k) => {
      const o = 3 * (sheets - k);
      return `<rect x="${x + o}" y="${x + o}" width="${size}" height="${size}" fill="${THERMAL}" stroke="${INK}" stroke-width="1.5"/>`;
    })
    .join('');
  const top = `<rect x="${x}" y="${x}" width="${size}" height="${size}" fill="${THERMAL}" stroke="${INK}" stroke-width="1.5"/>`;
  const chip = `<rect x="${x + size - 5}" y="${x - 6}" width="11" height="11" fill="${CHOP}" filter="url(#r)"/>`;
  STAMPS[`cluster-${sheets}`] = [60, stack + top];
  STAMPS[`cluster-${sheets}r`] = [60, stack + top + chip];
}

// Stamps are map images; a style switch drops them, so they are re-added.
function addStampImages(map: MapLibreMap) {
  const ratio = 2;
  for (const [id, [size, body]] of Object.entries(STAMPS)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * ratio}" height="${size * ratio}" viewBox="0 0 ${size} ${size}"><defs>${ROUGH}</defs>${body}</svg>`;
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
  const editing = useAppStore((state) => state.editing);
  const placing = useAppStore((state) => state.placing);
  const draft = useAppStore((state) => state.draft);
  const setDraft = useAppStore((state) => state.setDraft);
  const userLocation = useAppStore((state) => state.userLocation);
  const desktop = useDesktop();
  const stubHover = useAppStore((state) => state.rail.find((c) => c.id === state.stubHover));

  const map = useMap('map-layer');

  const selectedAt = useMemo<LatLng | null>(
    () => (selectedCoffee ? [selectedCoffee.lat, selectedCoffee.lng] : null),
    [selectedCoffee]
  );

  const byId = useMemo(() => new Map(data?.map((c) => [c.id, c]) ?? []), [data]);

  const geojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      // The selected shop is drawn as an HTML marker, so leaving it in would count it in a cluster.
      features: (data ?? [])
        .filter((c) => c.id !== selectedCoffee?.id)
        .map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
          properties: { id: c.id, status: c.status },
        })),
    }),
    [data, selectedCoffee?.id]
  );

  useEffect(() => {
    if (!map) return;
    addStampImages(map);
    const onStyle = () => {
      if (!map.hasImage('stamp-known')) addStampImages(map);
    };
    map.on('styledata', onStyle);
    return () => {
      map.off('styledata', onStyle);
    };
  }, [map, isDark]);

  // Center on the visitor once their position arrives; the map has already rendered by then.
  // L asks again and always flies there.
  useEffect(() => {
    if (!map || !navigator.geolocation) return;
    const locate = (force: boolean) =>
      navigator.geolocation.getCurrentPosition((p) => {
        useAppStore.getState().setUserLocation([p.coords.latitude, p.coords.longitude]);
        if (force || !useAppStore.getState().selectedCoffee) {
          map.flyTo({ center: [p.coords.longitude, p.coords.latitude], offset: panelOffset() });
        }
      });
    locate(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'l' && !isTypingTarget(e)) locate(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map]);

  useEffect(() => {
    if (!selectedCoffee) {
      return;
    }

    map?.flyTo({
      offset: panelOffset(),
      center: [selectedCoffee.lng, selectedCoffee.lat],
      zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1),
    });
  }, [selectedCoffee, map]);

  // Adding a shop: the next tap on the map is where it goes.
  useEffect(() => {
    if (!map || !placing) return;
    map.getCanvas().style.cursor = 'none';
    const onClick = (e: MapMouseEvent) => {
      useAppStore.setState({
        placing: false,
        editing: true,
        draft: [e.lngLat.lat, e.lngLat.lng],
        sheet: 'full',
      });
    };
    map.once('click', onClick);
    return () => {
      map.off('click', onClick);
      map.getCanvas().style.cursor = '';
    };
  }, [map, placing]);

  // An imported link can point anywhere; bring the pin into view once, not on every drag.
  const centeredEdit = useRef(false);
  useEffect(() => {
    if (!editing) {
      centeredEdit.current = false;
      return;
    }
    if (!map || !draft || centeredEdit.current) return;
    centeredEdit.current = true;
    map.flyTo({ center: [draft[1], draft[0]], offset: panelOffset() });
  }, [editing, draft, map]);

  const onClusterClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!map || !feature || feature.geometry.type !== 'Point') return;
      hoveredCluster.current = null;
      setClusterCard(null);
      const source = map.getSource<GeoJSONSource>('coffees');
      const zoom = await source?.getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: zoom ?? map.getZoom() + 2,
      });
    },
    [map]
  );

  // Hovering a bubble lists its first shops. The id is kept so a late answer for a bubble
  // the pointer already left does not open a card.
  const hoveredCluster = useRef<string | null>(null);
  const [clusterCard, setClusterCard] = useState<{
    lng: number;
    lat: number;
    coffees: Coffee[];
    total: number;
  } | null>(null);

  const onClusterEnter = useCallback(
    async (e: MapLayerMouseEvent) => {
      if (map) map.getCanvas().style.cursor = 'pointer';
      const feature = e.features?.[0];
      if (!map || !feature || feature.geometry.type !== 'Point') return;
      const clusterId = String(feature.properties.cluster_id);
      hoveredCluster.current = clusterId;
      const leaves = await map
        .getSource<GeoJSONSource>('coffees')
        ?.getClusterLeaves(feature.properties.cluster_id, 3, 0);
      if (hoveredCluster.current !== clusterId) return;
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      setClusterCard({
        lng,
        lat,
        coffees: (leaves ?? [])
          .map((leaf) => byId.get(leaf.properties?.id))
          .filter((c): c is Coffee => !!c),
        total: feature.properties.point_count,
      });
    },
    [map, byId]
  );

  const onClusterLeave = useCallback(() => {
    hoveredCluster.current = null;
    setClusterCard(null);
    if (map) map.getCanvas().style.cursor = '';
  }, [map]);

  const onPinClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (useAppStore.getState().placing || useAppStore.getState().editing) return;
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
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'icon-image': [
            'concat',
            'cluster-',
            ['step', ['get', 'point_count'], '1', 10, '2', 30, '3'],
            ['case', ['>', ['get', 'reviewed'], 0], 'r', ''],
          ],
          'icon-allow-overlap': true,
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['sono'],
          'text-size': ['step', ['get', 'point_count'], 13, 30, 15],
          'text-allow-overlap': true,
        }}
        paint={{ 'text-color': INK }}
        onClick={onClusterClick}
        onMouseEnter={onClusterEnter}
        onMouseLeave={onClusterLeave}
      />
      <RLayer
        id="coffee-pins"
        source="coffees"
        type="symbol"
        // The selected shop is drawn as an HTML marker instead.
        filter={['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], selectedCoffee?.id ?? '']]}
        layout={{
          'icon-image': ['match', ['get', 'status'], 'reviewed', 'stamp-reviewed', 'closed', 'stamp-closed', 'stamp-known'],
          'icon-allow-overlap': true,
          'symbol-sort-key': ['match', ['get', 'status'], 'reviewed', 1, 0],
        }}
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
      {editing && draft ? (
        <CoffeeMarker
          // New shops have no row yet; the pin only needs a position.
          coffee={{ ...(selectedCoffee ?? NEW_SHOP), lat: draft[0], lng: draft[1] }}
          isSelected
          onMove={setDraft}
        />
      ) : (
        selectedCoffee && <CoffeeMarker coffee={selectedCoffee} isSelected />
      )}
      {hoveredCoffee && hoveredCoffee.id !== selectedCoffee?.id && (
        <CoffeeMarker coffee={hoveredCoffee} isSelected={false} showCard />
      )}
      {editing && draft ? desktop && <Thread at={draft} /> : selectedAt && <Thread at={selectedAt} />}
      {stubHover && (
        <Thread at={[stubHover.lat, stubHover.lng]} from={`[data-stub="${stubHover.id}"]`} faint />
      )}
      {placing && <Plotter />}
      {userLocation && (
        <RMarker longitude={userLocation[1]} latitude={userLocation[0]} className="pointer-events-none">
          <span className="you-mark" />
        </RMarker>
      )}
      {clusterCard && (
        <RMarker
          longitude={clusterCard.lng}
          latitude={clusterCard.lat}
          initialAnchor="bottom"
          className="pointer-events-none"
        >
          {/* Half the stack, so the card starts at its top edge instead of covering it. */}
          <div
            className="relative"
            style={{ height: clusterCard.total < 10 ? 16 : clusterCard.total < 30 ? 18 : 21 }}
          >
            <CoffeeHoverCard coffees={clusterCard.coffees} total={clusterCard.total} />
          </div>
        </RMarker>
      )}
    </>
  );
}
