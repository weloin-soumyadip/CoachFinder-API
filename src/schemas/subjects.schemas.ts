import { z } from 'zod';
import { paginationFields } from './common.js';

// Create — `slug` is auto-derived by the model's pre('validate') hook, so it is
// intentionally absent here; .strict() rejects any attempt to forge it.
export const subjectCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(2000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type SubjectCreate = z.infer<typeof subjectCreateSchema>;

// Admin-PATCH — every field optional; name change re-slugs on save.
export const subjectAdminPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(2000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type SubjectAdminPatch = z.infer<typeof subjectAdminPatchSchema>;

// Public list filters — coerced from query strings.
export const subjectListQuerySchema = z
  .object({
    ...paginationFields,
    q: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
  })
  .strict();
export type SubjectListQuery = z.infer<typeof subjectListQuerySchema>;

// Admin list filters — same as public plus the `isActive` moderation flag.
export const adminSubjectListQuerySchema = z
  .object({
    ...paginationFields,
    q: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .strict();
export type AdminSubjectListQuery = z.infer<typeof adminSubjectListQuerySchema>;
