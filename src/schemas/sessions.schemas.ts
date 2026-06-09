import { z } from 'zod';
import { objectIdSchema, paginationFields } from './common.js';
import { SESSION_STATUSES } from '../models/Session.js';

// Create — the host teacher is taken from the token, never the body.
export const sessionCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    coachingCenter: objectIdSchema.optional(),
    subject: objectIdSchema.optional(),
    student: objectIdSchema.optional(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().min(0).max(1440).optional(),
    status: z.enum(SESSION_STATUSES).optional(),
  })
  .strict();

export type SessionCreate = z.infer<typeof sessionCreateSchema>;

// Update — reschedule, retitle, or change lifecycle status.
export const sessionUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    subject: objectIdSchema.optional(),
    student: objectIdSchema.optional(),
    scheduledAt: z.coerce.date().optional(),
    durationMinutes: z.number().int().min(0).max(1440).optional(),
    status: z.enum(SESSION_STATUSES).optional(),
  })
  .strict();

export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;

// List query — pagination + optional status and single-day (`date`) filters.
export const sessionListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(SESSION_STATUSES).optional(),
    date: z.coerce.date().optional(),
  })
  .strict();

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
