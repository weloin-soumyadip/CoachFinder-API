import { z } from 'zod';
import { objectIdSchema, paginationFields } from './common.js';

export const BOOKMARK_TARGET_TYPES = ['Teacher', 'Webinar', 'CoachingCenter'] as const;

// Create — author (student) comes from req.auth, never the body.
export const bookmarkCreateSchema = z
  .object({
    targetType: z.enum(BOOKMARK_TARGET_TYPES),
    targetId: objectIdSchema,
  })
  .strict();
export type BookmarkCreate = z.infer<typeof bookmarkCreateSchema>;

// List filters — pagination + optional target-type filter.
export const bookmarkListQuerySchema = z
  .object({
    ...paginationFields,
    targetType: z.enum(BOOKMARK_TARGET_TYPES).optional(),
  })
  .strict();
export type BookmarkListQuery = z.infer<typeof bookmarkListQuerySchema>;
