import type { Request, Response } from 'express';
import Teacher from '../models/Teacher.js';
import CoachingCenter from '../models/CoachingCenter.js';
import Webinar from '../models/Webinar.js';
import ApiError from '../utils/ApiError.js';
import { parseOrThrow } from '../middleware/validate.js';
import { escapeRegex } from '../lib/crud/escapeRegex.js';
import { resolveSubjectIds } from '../lib/crud/resolveSubjectIds.js';
import { projectTeacherPublic } from '../lib/crud/projectTeacherPublic.js';
import { projectCenterPublic } from '../lib/crud/projectCenterPublic.js';
import { projectWebinarPublic } from '../lib/crud/projectWebinarPublic.js';
import {
  SEARCH_TYPES,
  teacherSearchQuerySchema,
  centerSearchQuerySchema,
  webinarSearchQuerySchema,
  combinedSearchQuerySchema,
  type TeacherSearchQuery,
  type CenterSearchQuery,
  type WebinarSearchQuery,
  type CombinedSearchQuery,
} from '../schemas/search.schemas.js';

const EARTH_RADIUS_KM = 6378.1;

// `location` within `distanceKm` of [lng, lat] — works in find AND
// countDocuments (unlike $near) and imposes no sort, so we keep rating order.
const geoWithin = (lng: number, lat: number, distanceKm: number) => ({
  $geoWithin: { $centerSphere: [[lng, lat], distanceKm / EARTH_RADIUS_KM] },
});

// Teachers and centers both rank highest-rated first.
const RATING_SORT = { averageRating: -1 as const, totalReviews: -1 as const };

async function runTeacherSearch(query: TeacherSearchQuery, res: Response): Promise<void> {
  const { page, limit, q, subject, city, board, minRating, minFees, maxFees, lat, lng, distanceKm } =
    query;

  const filter: Record<string, unknown> = { isActive: true };
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { bio: rx }, { description: rx }];
  }
  if (subject) filter.subjects = { $in: await resolveSubjectIds(subject) };
  if (city) filter.city = city;
  if (board) filter.boards = board;
  if (minRating !== undefined) filter.averageRating = { $gte: minRating };
  if (maxFees !== undefined) filter['feesRange.min'] = { $lte: maxFees };
  if (minFees !== undefined) filter['feesRange.max'] = { $gte: minFees };
  if (lat !== undefined && lng !== undefined) filter.location = geoWithin(lng, lat, distanceKm);

  const [data, total] = await Promise.all([
    Teacher.find(filter)
      .sort(RATING_SORT)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('subjects', 'name slug'),
    Teacher.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: data.map(projectTeacherPublic),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

async function runCenterSearch(query: CenterSearchQuery, res: Response): Promise<void> {
  const { page, limit, q, subject, city, board, minRating, minFees, maxFees, lat, lng, distanceKm } =
    query;

  const filter: Record<string, unknown> = { isActive: true };
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { description: rx }, { area: rx }];
  }
  if (subject) filter.subjectsOffered = { $in: await resolveSubjectIds(subject) };
  if (city) filter.city = city;
  if (board) filter.boards = board;
  if (minRating !== undefined) filter.averageRating = { $gte: minRating };
  if (maxFees !== undefined) filter['fees.min'] = { $lte: maxFees };
  if (minFees !== undefined) filter['fees.max'] = { $gte: minFees };
  if (lat !== undefined && lng !== undefined) filter.location = geoWithin(lng, lat, distanceKm);

  const [data, total] = await Promise.all([
    CoachingCenter.find(filter)
      .sort(RATING_SORT)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('subjectsOffered', 'name slug')
      .lean(),
    CoachingCenter.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: data.map((c) => projectCenterPublic(c as Record<string, unknown>)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

async function runWebinarSearch(query: WebinarSearchQuery, res: Response): Promise<void> {
  const { page, limit, q, status, upcoming, teacher } = query;

  const filter: Record<string, unknown> = { isActive: true };
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ title: rx }, { description: rx }];
  }
  if (status) filter.status = status;
  if (upcoming) filter.scheduledAt = { $gte: new Date() };
  if (teacher) filter.teacher = teacher;

  const [data, total] = await Promise.all([
    Webinar.find(filter)
      .sort({ scheduledAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('teacher', 'name profileImage')
      .lean(),
    Webinar.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: data.map((w) => projectWebinarPublic(w as Record<string, unknown>)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// Per-type fetch cap for the combined feed. The merge happens in-app (so the
// existing public projections stay the single no-leak source of truth), so we
// bound how many of each type enter the mixable pool. Generous for current
// scale; switch to a $unionWith aggregation if data outgrows it.
const COMBINED_FETCH_CAP = 200;

// Deterministic pseudo-random key from a 24-hex ObjectId string. Stable per
// document, so the combined feed's order is identical across page requests
// (no duplicates / skips) while still looking shuffled rather than grouped.
// FNV-1a + a bit-mixing finalizer: sequential ObjectIds (e.g. a seeded batch)
// differ only in their low bytes, so we need strong avalanche or those records
// cluster together and one type dominates the first pages.
function shuffleKey(id: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193); // FNV prime
  }
  // xorshift finalizer for avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h | 0;
}

// No searchType → mixed feed of teachers + coachings + webinars. Keyword-only
// (`q`), each item tagged with `type`, stable-shuffled and paginated as one list.
async function runCombinedSearch(query: CombinedSearchQuery, res: Response): Promise<void> {
  const { page, limit, q } = query;
  const rx = q ? { $regex: escapeRegex(q), $options: 'i' } : undefined;

  const teacherFilter: Record<string, unknown> = { isActive: true };
  const centerFilter: Record<string, unknown> = { isActive: true };
  const webinarFilter: Record<string, unknown> = { isActive: true };
  if (rx) {
    teacherFilter.$or = [{ name: rx }, { bio: rx }, { description: rx }];
    centerFilter.$or = [{ name: rx }, { description: rx }, { area: rx }];
    webinarFilter.$or = [{ title: rx }, { description: rx }];
  }

  const [teachers, centers, webinars] = await Promise.all([
    Teacher.find(teacherFilter).limit(COMBINED_FETCH_CAP).populate('subjects', 'name slug'),
    CoachingCenter.find(centerFilter)
      .limit(COMBINED_FETCH_CAP)
      .populate('subjectsOffered', 'name slug')
      .lean(),
    Webinar.find(webinarFilter)
      .limit(COMBINED_FETCH_CAP)
      .populate('teacher', 'name profileImage')
      .lean(),
  ]);

  const pool: Array<Record<string, unknown>> = [
    ...teachers.map((t) => ({ type: 'teacher', ...projectTeacherPublic(t) })),
    ...centers.map((c) => ({ type: 'coaching', ...projectCenterPublic(c as Record<string, unknown>) })),
    ...webinars.map((w) => ({ type: 'webinar', ...projectWebinarPublic(w as Record<string, unknown>) })),
  ];

  // Stable shuffle: sort by a precomputed key derived from each item's _id.
  pool
    .map((item) => ({ item, key: shuffleKey(String(item._id)) }))
    .sort((a, b) => a.key - b.key)
    .forEach((entry, i) => {
      pool[i] = entry.item;
    });

  const total = pool.length;
  const start = (page - 1) * limit;
  const data = pool.slice(start, start + limit);

  res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// GET /api/search — student search. With no `searchType` (or empty) → combined
// mixed feed; otherwise validate the discriminator and dispatch to one type.
// Manual dispatch (not z.discriminatedUnion) because the teacher/center schemas
// carry a .refine() (geo-pair rule) and are ZodEffects, not bare ZodObjects.
const SCHEMAS = {
  teacher: teacherSearchQuerySchema,
  coaching: centerSearchQuerySchema,
  webinar: webinarSearchQuerySchema,
} as const;

export async function search(req: Request, res: Response): Promise<void> {
  const searchType = req.query.searchType;

  if (searchType === undefined || searchType === '') {
    return runCombinedSearch(parseOrThrow(combinedSearchQuerySchema, req.query, 'query'), res);
  }
  if (typeof searchType !== 'string' || !(searchType in SCHEMAS)) {
    throw new ApiError(400, `searchType must be one of: ${SEARCH_TYPES.join(', ')}`);
  }

  switch (searchType as keyof typeof SCHEMAS) {
    case 'teacher':
      return runTeacherSearch(parseOrThrow(teacherSearchQuerySchema, req.query, 'query'), res);
    case 'coaching':
      return runCenterSearch(parseOrThrow(centerSearchQuerySchema, req.query, 'query'), res);
    case 'webinar':
      return runWebinarSearch(parseOrThrow(webinarSearchQuerySchema, req.query, 'query'), res);
  }
}
