import type { Coffee } from '@rpcTypes/coffee.ts';
import { RMarker } from 'maplibre-react-components';
import { CoffeeListItem } from '../-contentTab/-common/-cofeeListItem.tsx';
import { type LatLng, useAppStore } from '@store/store.ts';

// The hover card: a torn receipt tag with one shop, or the first few in a cluster.
export function CoffeeHoverCard({ coffees, total }: { coffees: Coffee[]; total?: number }) {
  return (
    <div className="absolute bottom-full left-1/2 mb-1 w-72 -translate-x-1/2 font-atkinson drop-shadow-[0_6px_8px_rgb(0_0_0/.22)]">
      <ul className="receipt tear-b px-2 pt-1 pb-4">
        {coffees.map((coffee) => (
          <CoffeeListItem key={coffee.id} coffee={coffee} />
        ))}
        {total !== undefined && total > coffees.length && (
          <li className="px-2 pt-2 font-mono text-[13px]">+{total - coffees.length} more</li>
        )}
      </ul>
    </div>
  );
}

// A shop's ink stamp. Selected adds crop marks and the fluorescent square; draft is the blue tack.
export function Stamp({
  status,
  selected = false,
  draft = false,
}: {
  status?: Coffee['status'];
  selected?: boolean;
  draft?: boolean;
}) {
  const stamp = (
    <span
      className={`map-stamp ${draft ? 'draft' : status === 'reviewed' ? 'reviewed' : status === 'closed' ? 'closed' : ''}`}
    />
  );
  if (!selected) return stamp;
  return (
    <span className="crop">
      <i />
      <i />
      <i />
      <i />
      <span className="relative">{stamp}</span>
    </span>
  );
}

interface CoffeeMarkerProps {
  coffee: Coffee;
  isSelected: boolean;
  showCard?: boolean;
  // Set while editing: the stamp becomes a tack that can be dragged to move the shop.
  onMove?: (latLng: LatLng) => void;
}

// The selected or hovered shop, drawn as HTML on top of the map's stamp layer.
export function CoffeeMarker({ coffee, isSelected, showCard = false, onMove }: CoffeeMarkerProps) {
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const clearSelected = useAppStore((state) => state.removeSelectedCoffee);

  return (
    <RMarker
      longitude={coffee.lng}
      latitude={coffee.lat}
      // Hover only: letting the pointer through keeps the stamp layer's hover from flickering.
      className={showCard ? 'pointer-events-none' : onMove ? 'cursor-grab' : 'cursor-pointer'}
      // Tapping the selected stamp again closes the panel.
      onClick={() => !onMove && (isSelected ? clearSelected() : setSelected(coffee))}
      draggable={!!onMove}
      onDragEnd={(e) => {
        const { lat, lng } = e.target.getLngLat();
        onMove?.([lat, lng]);
      }}
    >
      {/* 44px square: the tap target, whatever the stamp's drawn size. */}
      <div className="relative grid size-11 place-items-center">
        <Stamp status={coffee.status} selected={isSelected} draft={!!onMove} />
        {showCard && <CoffeeHoverCard coffees={[coffee]} />}
      </div>
    </RMarker>
  );
}
