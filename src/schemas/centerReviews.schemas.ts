import { z } from 'zod';
import { paginationFields } from './common.js';

// Create — coaching center comes from the URL param, student from req.auth.
export const centerReviewCreateSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict();

// Update — rating and/or comment.
export const centerReviewUpdateSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict();

// Public list query — pagination only.
export const centerReviewListQuerySchema = z
  .object({
    ...paginationFields,
  })
  .strict();

export type CenterReviewCreate = z.infer<typeof centerReviewCreateSchema>;
export type CenterReviewUpdate = z.infer<typeof centerReviewUpdateSchema>;
export type CenterReviewListQuery = z.infer<typeof centerReviewListQuerySchema>;
