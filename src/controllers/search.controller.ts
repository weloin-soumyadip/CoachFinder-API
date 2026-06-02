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
  type TeacherSearchQuery,
  type CenterSearchQuery,
  type WebinarSearchQuery,
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

// GET /api/search?searchType=teacher|coaching|webinar — validate the discriminator
// first, then parse the rest with the matching per-type schema and dispatch.
// Manual dispatch (not z.discriminatedUnion) because the teacher/center schemas
// carry a .refine() (geo-pair rule) and are ZodEffects, not bare ZodObjects.
const SCHEMAS = {
  teacher: teacherSearchQuerySchema,
  coaching: centerSearchQuerySchema,
  webinar: webinarSearchQuerySchema,
} as const;

export async function search(req: Request, res: Response): Promise<void> {
  const searchType = req.query.searchType;
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
