import type { Generated, Selectable } from 'kysely';
import { array, custom, object, string } from 'valibot';

export interface ImageTable {
  id: string;
  url: string;
  alt: string;
  coffee_id: string;
  // Display order; 0 is the shop's thumbnail.
  position: Generated<number>;
}

export type Image = Selectable<ImageTable>;

export const ImageUploadSchema = object({
  id: string(),
  file: custom<File>((v) => v instanceof File, 'Expected a File'),
});

export const ImageOrderSchema = object({
  coffeeId: string(),
  ids: array(string()),
});
