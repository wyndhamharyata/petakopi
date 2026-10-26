import type { ReactNode } from 'react';
import { RiArrowLeftSLine } from 'react-icons/ri';

// Shared by the shop and edit views: a plain chevron in the title row, so the row balances itself.
export function PanelHeader({
  title,
  onBack,
  backLabel,
  children,
}: {
  title: string;
  onBack: () => void;
  backLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 gap-2 border-b border-base-300 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        title={`${backLabel} (Esc)`}
        aria-label={backLabel}
        // The glyph has side bearing; -ml-1.5 puts its stroke on the 16px content edge.
        className="-ml-1.5 flex h-7 w-6 shrink-0 cursor-pointer items-center justify-center text-base-content/70 hover:text-base-content"
      >
        <RiArrowLeftSLine size={24} />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold leading-7 line-clamp-2">{title}</h2>
        {children && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
