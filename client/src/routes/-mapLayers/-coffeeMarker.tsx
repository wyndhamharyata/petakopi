import type { Coffee } from '@rpcTypes/coffee.ts';
import { RMarker } from 'maplibre-react-components';
import { CoffeeListItem } from '../-contentTab/-common/-cofeeListItem.tsx';
import { RiMapPin2Fill } from 'react-icons/ri';

interface CoffeeMarkerProps {
  coffee: Coffee;
  isSelected: boolean;
  showCard?: boolean;
}

// The selected or hovered shop, drawn as HTML on top of the map's pin layer.
export function CoffeeMarker({ coffee, isSelected, showCard = false }: CoffeeMarkerProps) {
  const pinClass = isSelected
    ? 'fill-primary stroke-base-content dark:stroke-accent dark:fill-base-100 text-[50px]'
    : 'fill-base-100 stroke-accent dark:stroke-base-content text-[40px]';

  return (
    <RMarker
      longitude={coffee.lng}
      latitude={coffee.lat}
      initialAnchor="bottom"
      // Hover only: letting the pointer through keeps the pin layer's hover from flickering.
      className={showCard ? 'pointer-events-none' : ''}
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
