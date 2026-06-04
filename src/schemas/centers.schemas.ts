import { z } from 'zod';
import {
  locationSchema,
  objectIdSchema,
  paginationFields,
  phoneSchema,
  profileImageSchema,
} from './common.js';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/; // 'HH:mm' 24-hour
const DAY_VALUES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const BOARD_VALUES = ['CBSE', 'ICSE', 'State', 'IB', 'IGCSE', 'Other'] as const;

const classRangeSchema = z
  .object({
    from: z.number().int().min(1).max(12).optional(),
    to: z.number().int().min(1).max(12).optional(),
  })
  .strict()
  .refine((v) => v.from === undefined || v.to === undefined || v.from <= v.to, {
    message: 'from must be <= to',
    path: ['from'],
  });

const feesSchema = z
  .object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.string().trim().min(1).max(8).optional(),
  })
  .strict()
  .refine((v) => v.min === undefined || v.max === undefined || v.min <= v.max, {
    message: 'min must be <= max',
    path: ['min'],
  });

const timingItemSchema = z
  .object({
    day: z.enum(DAY_VALUES),
    openTime: z.string().regex(TIME_REGEX, 'must be HH:mm').optional(),
    closeTime: z.string().regex(TIME_REGEX, 'must be HH:mm').optional(),
    closed: z.boolean().optional(),
  })
  .strict();

// Field set for create. `slug`, `owner`, `isActive`, `isVerified`,
// `averageRating`, `totalReviews` are intentionally ABSENT — slug is auto-derived
// by the model's pre('validate') hook, owner comes from the token, and the rest
// are server-/moderation-controlled. `.strict()` rejects any attempt to set them.
const centerFields = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(10000).optional(),
  address: z.string().trim().min(1).max(500),
  location: locationSchema,
  area: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  pincode: z.string().trim().min(1).max(12),
  country: z.string().trim().min(1).max(80).optional(),
  phone: phoneSchema,
  alternatePhone: phoneSchema.optional(),
  email: z.string().trim().email().max(254).optional(),
  website: z.string().trim().url().max(2048).optional(),
  subjectsOffered: z.array(objectIdSchema).optional(),
  boards: z.array(z.enum(BOARD_VALUES)).optional(),
  classRange: classRangeSchema.optional(),
  fees: feesSchema.optional(),
  timings: z.array(timingItemSchema).optional(),
  profileImage: profileImageSchema.optional(),
  bannerImage: profileImageSchema.optional(),
  gallery: z.array(profileImageSchema).optional(),
} as const;

export const centerCreateSchema = z.object(centerFields).strict();
export type CenterCreate = z.infer<typeof centerCreateSchema>;

// Update — every field optional; name/city change re-slugs on save.
export const centerUpdateSchema = z.object(centerFields).partial().strict();
export type CenterUpdate = z.infer<typeof centerUpdateSchema>;

// Public list filters — coerced from query strings.
export const centerListQuerySchema = z
  .object({
    ...paginationFields,
    q: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    board: z.enum(BOARD_VALUES).optional(),
    isVerified: z.coerce.boolean().optional(),
  })
  .strict();
export type CenterListQuery = z.infer<typeof centerListQuerySchema>;
