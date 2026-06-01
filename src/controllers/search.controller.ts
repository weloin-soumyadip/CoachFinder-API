import type { Request, Response } from 'express';
import Teacher from '../models/Teacher.js';
import CoachingCenter from '../models/CoachingCenter.js';
import { escapeRegex } from '../lib/crud/escapeRegex.js';
import { resolveSubjectIds } from '../lib/crud/resolveSubjectIds.js';
import { projectTeacherPublic } from '../lib/crud/projectTeacherPublic.js';
import { projectCenterPublic } from '../lib/crud/projectCenterPublic.js';
import type { TeacherSearchQuery, CenterSearchQuery } from '../schemas/search.schemas.js';

const EARTH_RADIUS_KM = 6378.1;

// `location` within `distanceKm` of [lng, lat] — works in find AND
// countDocuments (unlike $near) and imposes no sort, so we keep rating order.
const geoWithin = (lng: number, lat: number, distanceKm: number) => ({
  $geoWithin: { $centerSphere: [[lng, lat], distanceKm / EARTH_RADIUS_KM] },
});

const SORT = { averageRating: -1 as const, totalReviews: -1 as const };

export async function searchTeachers(req: Request, res: Response): Promise<void> {
  const { page, limit, q, subject, city, board, minRating, minFees, maxFees, lat, lng, distanceKm } =
    req.query as unknown as TeacherSearchQuery;

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
      .sort(SORT)
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

export async function searchCenters(req: Request, res: Response): Promise<void> {
  const { page, limit, q, subject, city, board, minRating, minFees, maxFees, lat, lng, distanceKm } =
    req.query as unknown as CenterSearchQuery;

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
      .sort(SORT)
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
