// Public-facing coaching-center projection. Centers are business listings, so
// contact info (phone, email, address, website) is intentionally public; only
// internal fields (owner, isActive, __v) are withheld. Allow-list (not
// deny-list) so any sensitive field added later won't accidentally leak.
const PUBLIC_FIELDS = [
  '_id',
  'name',
  'slug',
  'description',
  'address',
  'location',
  'area',
  'city',
  'state',
  'pincode',
  'country',
  'phone',
  'alternatePhone',
  'email',
  'website',
  'subjectsOffered',
  'boards',
  'classRange',
  'fees',
  'timings',
  'profileImage',
  'bannerImage',
  'gallery',
  'averageRating',
  'totalReviews',
  'isVerified',
  'createdAt',
] as const;

// Accepts a lean object (or any plain record) and copies the allow-listed keys.
export function projectCenterPublic(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
