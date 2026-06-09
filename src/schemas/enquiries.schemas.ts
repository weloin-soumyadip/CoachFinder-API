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

// Teacher update — same shape as the owner: set status and/or private notes on a
// teacher-targeted enquiry.
export const enquiryTeacherUpdateSchema = z
  .object({
    status: z.enum(ENQUIRY_STATUSES).optional(),
    ownerNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type EnquiryTeacherUpdate = z.infer<typeof enquiryTeacherUpdateSchema>;

// Owner list query — pagination + optional status filter.
export const enquiryOwnerListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(ENQUIRY_STATUSES).optional(),
  })
  .strict();

export type EnquiryOwnerListQuery = z.infer<typeof enquiryOwnerListQuerySchema>;

// Teacher "enquiries for me" list query — same shape as the owner list.
export const enquiryTeacherListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(ENQUIRY_STATUSES).optional(),
  })
  .strict();

export type EnquiryTeacherListQuery = z.infer<typeof enquiryTeacherListQuerySchema>;

// Student "my enquiries" list query — same shape as the owner list.
export const enquiryStudentListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(ENQUIRY_STATUSES).optional(),
  })
  .strict();

export type EnquiryStudentListQuery = z.infer<typeof enquiryStudentListQuerySchema>;

// dateFrom must not be after dateTo (shared by both search schemas).
const dateRangeRefine = (v: { dateFrom?: Date; dateTo?: Date }): boolean =>
  v.dateFrom === undefined || v.dateTo === undefined || v.dateFrom <= v.dateTo;
const dateRangeMessage = { message: 'dateFrom must be <= dateTo', path: ['dateFrom'] };

// Owner enquiry search — every filter optional; `subject`/`student` accept an
// ObjectId OR human text (name/slug, name/email), so they're free strings.
export const enquiryOwnerSearchQuerySchema = z
  .object({
    ...paginationFields,
    q: z.string().trim().min(1).optional(),
    status: z.enum(ENQUIRY_STATUSES).optional(),
    subject: z.string().trim().min(1).optional(),
    student: z.string().trim().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict()
  .refine(dateRangeRefine, dateRangeMessage);

export type EnquiryOwnerSearchQuery = z.infer<typeof enquiryOwnerSearchQuerySchema>;

// Student enquiry search — same as owner minus the `student` filter (always self)
// and minus any ownerNotes exposure (handled in the controller projection).
export const enquiryStudentSearchQuerySchema = z
  .object({
    ...paginationFields,
    q: z.string().trim().min(1).optional(),
    status: z.enum(ENQUIRY_STATUSES).optional(),
    subject: z.string().trim().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict()
  .refine(dateRangeRefine, dateRangeMessage);

export type EnquiryStudentSearchQuery = z.infer<typeof enquiryStudentSearchQuerySchema>;
