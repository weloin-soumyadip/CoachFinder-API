import type { Request, Response } from 'express';
import ApiError from '../utils/ApiError.js';
import CoachingCenter from '../models/CoachingCenter.js';
import { escapeRegex } from '../lib/crud/escapeRegex.js';
import { projectCenterPublic } from '../lib/crud/projectCenterPublic.js';
// Side-effect import: registers the Subject schema so populate('subjectsOffered')
// works regardless of route mount order.
import '../models/Subject.js';
import type { CenterCreate, CenterUpdate, CenterListQuery } from '../schemas/centers.schemas.js';

function requireOwner(req: Request) {
  if (!req.auth || req.auth.type !== 'owner') {
    throw new ApiError(401, 'Not authenticated as owner');
  }
  return req.auth.doc;
}

// Mongo duplicate-key (E11000) guard — slug is unique on the model. The global
// handler only reshapes the `email` index, so handle centers here.
const isDuplicateKey = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

// POST /api/centers — owner creates their coaching center.
// One owner = one center: 409 if the owner already has one.
export async function create(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);

  const existing = await CoachingCenter.exists({ owner: owner._id });
  if (existing) throw new ApiError(409, 'You already have a coaching center');

  const center = new CoachingCenter({ ...(req.body as CenterCreate), owner: owner._id });
  try {
    await center.save(); // fires the slug pre('validate') hook
  } catch (err) {
    if (isDuplicateKey(err)) throw new ApiError(409, 'Coaching center already exists');
    throw err;
  }
  res.status(201).json({ center });
}

// GET /api/centers — public list of active centers, paginated + filtered.
export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, q, city, board, isVerified } = req.query as unknown as CenterListQuery;

  const filter: Record<string, unknown> = { isActive: true };
  if (city) filter.city = city;
  if (board) filter.boards = board;
  if (isVerified !== undefined) filter.isVerified = isVerified;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { description: rx }, { area: rx }];
  }

  const [docs, total] = await Promise.all([
    CoachingCenter.find(filter)
      .sort({ averageRating: -1, totalReviews: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('subjectsOffered', 'name slug')
      .lean(),
    CoachingCenter.countDocuments(filter),
  ]);

  res.status(200).json({
    data: docs.map((d) => projectCenterPublic(d as Record<string, unknown>)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// GET /api/centers/me — owner fetches their OWN center (any active state).
export async function getMine(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const center = await CoachingCenter.findOne({ owner: owner._id }).populate(
    'subjectsOffered',
    'name slug',
  );
  if (!center) throw new ApiError(404, 'No coaching center found for this owner');
  res.status(200).json({ center });
}

// GET /api/centers/:id — public center profile. 404 on missing OR deactivated
// so we don't leak the existence of soft-deleted centers.
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const center = await CoachingCenter.findOne({ _id: id, isActive: true })
    .populate('subjectsOffered', 'name slug')
    .lean();
  if (!center) throw new ApiError(404, 'Coaching center not found');
  res.status(200).json({ center: projectCenterPublic(center as Record<string, unknown>) });
}

// PATCH /api/centers/:id — owner-only edit of their own center.
export async function update(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const { id } = req.params as { id: string };
  const updates = req.body as CenterUpdate;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }

  const center = await CoachingCenter.findById(id);
  if (!center) throw new ApiError(404, 'Coaching center not found');
  if (String(center.owner) !== String(owner._id)) {
    throw new ApiError(403, 'Not your coaching center');
  }

  Object.assign(center, updates);
  try {
    await center.save(); // re-runs validators + re-slugs on name/city change
  } catch (err) {
    if (isDuplicateKey(err)) throw new ApiError(409, 'Coaching center already exists');
    throw err;
  }
  res.status(200).json({ center });
}

// DELETE /api/centers/:id — owner-only soft-delete (isActive=false).
export async function remove(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const { id } = req.params as { id: string };

  const center = await CoachingCenter.findById(id);
  if (!center) throw new ApiError(404, 'Coaching center not found');
  if (String(center.owner) !== String(owner._id)) {
    throw new ApiError(403, 'Not your coaching center');
  }

  center.isActive = false;
  await center.save();
  res.status(204).end();
}
