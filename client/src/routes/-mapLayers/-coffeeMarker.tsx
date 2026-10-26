import type { Coffee } from '@rpcTypes/coffee.ts';
import { RMarker } from 'maplibre-react-components';
import { CoffeeListItem } from '../-contentTab/-common/-cofeeListItem.tsx';
import { RiMapPin2Fill } from 'react-icons/ri';
import { useAppStore } from '@store/store.ts';

interface CoffeeMarkerProps {
  coffee: Coffee;
  isSelected: boolean;
  showCard?: boolean;
}

// The selected or hovered shop, drawn as HTML on top of the map's pin layer.
export function CoffeeMarker({ coffee, isSelected, showCard = false }: CoffeeMarkerProps) {
  const setSelected = useAppStore((state) => state.setSelectedCoffee);
  // Same look in both themes, larger than any layer pin, so the selection never reads as "reviewed".
  const pinClass = isSelected
    ? 'fill-primary stroke-base-content text-[56px] drop-shadow-lg'
    : coffee.status === 'reviewed'
      ? 'fill-base-100 stroke-primary text-[40px] [&_path]:[stroke-width:2.6]'
      : 'fill-base-100 stroke-accent text-[40px]';

  return (
    <RMarker
      longitude={coffee.lng}
      latitude={coffee.lat}
      initialAnchor="bottom"
      // Hover only: letting the pointer through keeps the pin layer's hover from flickering.
      className={showCard ? 'pointer-events-none' : 'cursor-pointer'}
      onClick={() => setSelected(coffee)}
    >
      <div className="relative">
        <RiMapPin2Fill
          className={`${pinClass} ${coffee.status === 'closed' ? 'opacity-40' : ''}`}
          strokeWidth={1.7}
        />
        {showCard && (
          <ul className="absolute bottom-full left-1/2 mb-1 w-72 -translate-x-1/2 p-2 card bg-base-100 border-2 border-base-300 font-atkinson shadow-xl">
            <CoffeeListItem coffee={coffee} />
          </ul>
        )}
      </div>
    </RMarker>
  );
}
