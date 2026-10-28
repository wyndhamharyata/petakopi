import type { Coffee } from '@rpcTypes/coffee.ts';
import { RMarker } from 'maplibre-react-components';
import { CoffeeListItem } from '../-contentTab/-common/-cofeeListItem.tsx';
import { RiMapPin2Fill } from 'react-icons/ri';
import { type LatLng, useAppStore } from '@store/store.ts';

// The hover card: one shop, or the first few in a cluster.
export function CoffeeHoverCard({ coffees, total }: { coffees: Coffee[]; total?: number }) {
  return (
    <ul className="absolute bottom-full left-1/2 mb-1 w-72 -translate-x-1/2 rounded-box border border-base-300 bg-base-100 p-1 font-atkinson shadow-xl">
      {coffees.map((coffee) => (
        <CoffeeListItem key={coffee.id} coffee={coffee} />
      ))}
      {total !== undefined && total > coffees.length && (
        <li className="px-3 py-2 text-[13px] text-base-content/60">
          +{total - coffees.length} more
        </li>
      )}
    </ul>
  );
}

interface CoffeeMarkerProps {
  coffee: Coffee;
  isSelected: boolean;
  showCard?: boolean;
  // Set while editing: the pin can be dragged to move the shop.
  onMove?: (latLng: LatLng) => void;
}

// The selected or hovered shop, drawn as HTML on top of the map's pin layer.
export function CoffeeMarker({ coffee, isSelected, showCard = false, onMove }: CoffeeMarkerProps) {
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  const clearSelected = useAppStore((state) => state.removeSelectedCoffee);
  // The only filled pin, ringed in the base colour with a primary glow, so it never reads as "reviewed".
  const pinClass = isSelected
    ? 'relative fill-primary stroke-base-100 text-[50px] drop-shadow-lg drop-shadow-primary/60'
    : coffee.status === 'reviewed'
      ? 'fill-base-100 stroke-primary text-[40px] [&_path]:[stroke-width:2.6]'
      : 'fill-base-100 stroke-accent text-[40px]';

  return (
    <RMarker
      longitude={coffee.lng}
      latitude={coffee.lat}
      initialAnchor="bottom"
      // Hover only: letting the pointer through keeps the pin layer's hover from flickering.
      className={showCard ? 'pointer-events-none' : onMove ? 'cursor-grab' : 'cursor-pointer'}
      // Tapping the selected pin again closes the panel.
      onClick={() => !onMove && (isSelected ? clearSelected() : setSelected(coffee))}
      draggable={!!onMove}
      onDragEnd={(e) => {
        const { lat, lng } = e.target.getLngLat();
        onMove?.([lat, lng]);
      }}
    >
      <div className="relative">
        {isSelected && (
          // Pulsing ring on the ground at the shop's exact spot.
          <span className="absolute bottom-0 left-1/2 size-8 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/40 animate-ping [animation-duration:1.8s] motion-reduce:animate-none" />
        )}
        <RiMapPin2Fill
          className={`${pinClass} ${coffee.status === 'closed' ? 'opacity-40' : ''}`}
          strokeWidth={1.7}
        />
        {showCard && <CoffeeHoverCard coffees={[coffee]} />}
      </div>
    </RMarker>
  );
}
