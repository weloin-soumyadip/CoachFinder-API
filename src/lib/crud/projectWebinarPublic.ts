// Public-facing webinar projection. Allow-list (not deny-list) so internal
// fields (isActive, __v, updatedAt) never leak and any field added later is
// opt-in. Shared by the webinars list/detail controller and webinar search.
const PUBLIC_FIELDS = [
  '_id',
  'title',
  'description',
  'teacher',
  'scheduledAt',
  'durationMinutes',
  'thumbnail',
  'joinUrl',
  'status',
  'createdAt',
] as const;

// Accepts a lean object (or any plain record) and copies the allow-listed keys.
export function projectWebinarPublic(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
