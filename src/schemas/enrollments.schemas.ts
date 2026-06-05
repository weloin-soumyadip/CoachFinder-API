import { z } from 'zod';
import { objectIdSchema, paginationFields } from './common.js';
import { ENROLLMENT_STATUSES } from '../models/Enrollment.js';

// Create — coaching center is auto-resolved from the owner's token, never the body.
export const enrollmentCreateSchema = z
  .object({
    studentId: objectIdSchema,
    subject: objectIdSchema.optional(),
    status: z.enum(ENROLLMENT_STATUSES).optional(),
  })
  .strict();

// Update — status transition and/or subject reassignment.
export const enrollmentUpdateSchema = z
  .object({
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    subject: objectIdSchema.optional(),
  })
  .strict();

// List query — pagination + optional status filter.
export const enrollmentListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(ENROLLMENT_STATUSES).optional(),
  })
  .strict();

export type EnrollmentCreate = z.infer<typeof enrollmentCreateSchema>;
export type EnrollmentUpdate = z.infer<typeof enrollmentUpdateSchema>;
export type EnrollmentListQuery = z.infer<typeof enrollmentListQuerySchema>;
