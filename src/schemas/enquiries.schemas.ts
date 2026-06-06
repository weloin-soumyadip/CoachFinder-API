import { z } from 'zod';
import { objectIdSchema, paginationFields } from './common.js';
import { ENQUIRY_STATUSES } from '../models/Enquiry.js';

// Create — coaching center comes from the URL param, student from req.auth.
export const enquiryCreateSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    subject: objectIdSchema.optional(),
  })
  .strict();

export type EnquiryCreate = z.infer<typeof enquiryCreateSchema>;

// Owner update — set lifecycle status and/or private notes on an enquiry.
export const enquiryOwnerUpdateSchema = z
  .object({
    status: z.enum(ENQUIRY_STATUSES).optional(),
    ownerNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type EnquiryOwnerUpdate = z.infer<typeof enquiryOwnerUpdateSchema>;

// Owner list query — pagination + optional status filter.
export const enquiryOwnerListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(ENQUIRY_STATUSES).optional(),
  })
  .strict();

export type EnquiryOwnerListQuery = z.infer<typeof enquiryOwnerListQuerySchema>;

// Student "my enquiries" list query — same shape as the owner list.
export const enquiryStudentListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(ENQUIRY_STATUSES).optional(),
  })
  .strict();

export type EnquiryStudentListQuery = z.infer<typeof enquiryStudentListQuerySchema>;
