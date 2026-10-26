import { type OpenHour } from './openHour';
import type { Selectable } from 'kysely';
import {
  boolean,
  custom,
  maxValue,
  minValue,
  multipleOf,
  number,
  optional,
  minLength,
  object,
  pipe,
  string,
  transform,
} from 'valibot';

export interface CoffeeTable {
  id: string;
  lat: number;
  lng: number;
  address: string;
  name: string;
  rating: number;
  created_at: Date | string;
  updated_at: Date | string;
  status: 'known' | 'reviewed' | 'closed';
  open_hours: OpenHour;
}

// `thumbnail_url` is joined in by the list endpoints, not stored on the row.
export type Coffee = Selectable<CoffeeTable> & { thumbnail_url?: string | null };

const validateLatLng = (lat: number, lng: number): boolean => {
  const isLatValid = !isNaN(lat) && lat >= -90 && lat <= 90;
  const isLngValid = !isNaN(lng) && lng >= -180 && lng <= 180;
  return isLatValid && isLngValid;
};

const latLngFromStringSchema = pipe(
  string(),
  custom((value) => {
    const parts = (value as string).trim().split(',');
    if (parts.length !== 2) return false;

    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());

    return validateLatLng(lat, lng);
  }, 'Location must be "lat, long"'),
  transform<string, [number, number]>((input) => {
    const parts = (input as string).trim().split(',');

    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());

    return [lat, lng];
  })
);

const latLngTupleSchema = custom<[number, number]>((value) => {
  if (!Array.isArray(value) || value.length !== 2) return false;

  const [lat, lng] = value;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    validateLatLng(lat, lng)
  );
}, 'Must be a valid [number, number] with latitude between -90 and 90, longitude between -180 and 180');

const openHourSchema = pipe(
  string(),
  custom((value) => {
    // Empty means "hours unknown".
    if ((value as string).trim() === '') return true;
    const parts = (value as string).trim().split('-');
    if (parts.length !== 2) return false;

    for (const p of parts) {
      const subPart = p.trim().split(':');
      if (subPart.length !== 2) return false;

      const hour = parseInt(subPart[0]);
      const minute = parseInt(subPart[1]);

      if (hour > 24 || hour < 0) {
        return false;
      }

      if (minute > 60 || minute < 0) {
        return false;
      }
    }

    return true;
  }, 'Hours must be HH:MM-HH:MM, or left unknown')
);

export const ModifyCoffeeSchema = object({
  shopName: pipe(string(), minLength(2, 'Name is too short')),
  latLong: latLngFromStringSchema,
  openHours: openHourSchema,
  // Optional: 50 imported shops have no address yet.
  address: string(),
  closed: boolean(),
  // Quick rating for shops without a review; a review's rating overrides it.
  rating: optional(pipe(number(), minValue(0), maxValue(5), multipleOf(0.5))),
});

export const ModifyCoffeeReqSchema = object({
  ...ModifyCoffeeSchema.entries,
  latLong: latLngTupleSchema,
});
