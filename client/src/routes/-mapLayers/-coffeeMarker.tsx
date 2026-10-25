import type { Coffee } from '@rpcTypes/coffee.ts';
import { RMarker } from 'maplibre-react-components';
import { CoffeeListItem } from '../-contentTab/-common/-cofeeListItem.tsx';
import { RiMapPin2Fill } from 'react-icons/ri';

interface CoffeeMarkerProps {
  coffee: Coffee;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (coffee: Coffee) => void;
  onHover: (id: string | undefined) => void;
}

export function CoffeeMarker({
  coffee,
  isSelected,
  isHovered,
  onClick,
  onHover,
}: CoffeeMarkerProps) {
  const popupOffset = isSelected ? [-128, -140] : [-128, -130];
  const pinSize = isSelected ? '50px' : '40px';
  const pinClass = isSelected
    ? 'fill-primary/70 stroke-accent dark:stroke-accent dark:fill-base-100 text-[50px]'
    : 'fill-base-100 stroke-accent dark:stroke-base-content text-[40px]';

  return (
    <RMarker
      longitude={coffee.lng}
      latitude={coffee.lat}
      initialAnchor="bottom"
      onClick={() => onClick(coffee)}
    >
      <div
        className="cursor-pointer"
        onMouseEnter={() => onHover(coffee.id)}
        onMouseLeave={() => onHover(undefined)}
      >
        <RiMapPin2Fill
          className={`${pinClass} text-[${pinSize}] ${coffee.status === 'closed' ? 'opacity-40' : ''}`}
          strokeWidth={1.7}
        />
        <div
          className={`${
            !isHovered ? 'hidden' : ''
          } absolute p-2 w-72 card bg-base-100 border-2 border-base-300 font-sono shadow-xl`}
          style={{
            transform: `translate(${popupOffset[0]}px, ${popupOffset[1]}px)`,
          }}
        >
          <CoffeeListItem coffee={coffee} />
        </div>
      </div>
    </RMarker>
  );
}
