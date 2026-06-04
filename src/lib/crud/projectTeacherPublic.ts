import type { TeacherDoc } from '../../models/Teacher.js';

// Public-facing teacher projection — excludes contact info and internal/audit
// flags. Allow-list (not deny-list) so any new sensitive field added later
// won't accidentally leak.
const PUBLIC_FIELDS = [
  '_id',
  'name',
  'profileImage',
  'bio',
  'description',
  'subjects',
  'education',
  'experienceYears',
  'feesRange',
  'batches',
  'languages',
  'boards',
  'classRange',
  'location',
  'city',
  'state',
  'averageRating',
  'totalReviews',
  'isVerified',
  'createdAt',
] as const;

// Accepts either a hydrated TeacherDoc or a plain object (e.g. a `.lean()`
// populate result) — `.toObject` is only called when present, so lean callers
// pass the plain object straight through.
export function projectTeacherPublic(
  input: TeacherDoc | Record<string, unknown>,
): Record<string, unknown> {
  const obj =
    typeof (input as TeacherDoc).toObject === 'function'
      ? ((input as TeacherDoc).toObject({ versionKey: false }) as Record<string, unknown>)
      : (input as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
