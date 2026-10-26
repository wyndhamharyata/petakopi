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
      className={showCard ? 'pointer-events-none' : 'cursor-pointer'}
      onClick={() => setSelected(coffee)}
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
        {showCard && (
          <ul className="absolute bottom-full left-1/2 mb-1 w-72 -translate-x-1/2 p-2 card bg-base-100 border-2 border-base-300 font-atkinson shadow-xl">
            <CoffeeListItem coffee={coffee} />
          </ul>
        )}
      </div>
    </RMarker>
  );
}
