import { memo } from 'react';

interface RatingProps {
  ratingValue?: number;
  size?: 'xs' | 'sm';
}

// Read-only half stars. Stars are the only use of `warning`, so blue keeps meaning "known".
export const Rating = memo(function Rating({ ratingValue = 0, size = 'xs' }: RatingProps) {
  if (ratingValue === 0) return null;
  return (
    <div
      className={`rating rating-half ${size === 'xs' ? 'rating-xs' : 'rating-sm'}`}
      aria-label={`${ratingValue} out of 5 stars`}
    >
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className={`mask mask-star-2 ${i % 2 === 0 ? 'mask-half-1' : 'mask-half-2'} bg-warning`}
          aria-current={ratingValue >= (i + 1) / 2}
        />
      ))}
    </div>
  );
});
