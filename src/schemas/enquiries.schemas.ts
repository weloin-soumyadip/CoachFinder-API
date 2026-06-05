import { z } from 'zod';
import { objectIdSchema } from './common.js';

// Create — coaching center comes from the URL param, student from req.auth.
export const enquiryCreateSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    subject: objectIdSchema.optional(),
  })
  .strict();

export type EnquiryCreate = z.infer<typeof enquiryCreateSchema>;
