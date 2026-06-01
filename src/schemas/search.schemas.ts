import { z } from 'zod';
import { paginationFields } from './common.js';

const BOARD_VALUES = ['CBSE', 'ICSE', 'State', 'IB', 'IGCSE', 'Other'] as const;

// Shared search filters. `subject` accepts an ObjectId or human text (name/slug)
// — resolved server-side. Geo fields are coerced from query strings; lat/lng
// must be supplied together (enforced by the refine below).
const searchQueryShape = {
  ...paginationFields,
  q: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  board: z.enum(BOARD_VALUES).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minFees: z.coerce.number().min(0).optional(),
  maxFees: z.coerce.number().min(0).optional(),
  lat: z.coerce.number().gte(-90).lte(90).optional(),
  lng: z.coerce.number().gte(-180).lte(180).optional(),
  distanceKm: z.coerce.number().gt(0).lte(500).default(10),
} as const;

const geoPairRefine = (v: { lat?: number; lng?: number }): boolean =>
  (v.lat === undefined) === (v.lng === undefined);
const geoPairMessage = { message: 'lat and lng must be provided together', path: ['lat'] };

export const teacherSearchQuerySchema = z
  .object(searchQueryShape)
  .strict()
  .refine(geoPairRefine, geoPairMessage);
export type TeacherSearchQuery = z.infer<typeof teacherSearchQuerySchema>;

export const centerSearchQuerySchema = z
  .object(searchQueryShape)
  .strict()
  .refine(geoPairRefine, geoPairMessage);
export type CenterSearchQuery = z.infer<typeof centerSearchQuerySchema>;
