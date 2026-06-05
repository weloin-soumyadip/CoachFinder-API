import type { Request, Response } from 'express';
import CoachingCenterReview from '../models/CoachingCenterReview.js';
import CoachingCenter from '../models/CoachingCenter.js';
import ApiError from '../utils/ApiError.js';
import type {
  CenterReviewCreate,
  CenterReviewUpdate,
  CenterReviewListQuery,
} from '../schemas/centerReviews.schemas.js';

function requireStudent(req: Request) {
  if (!req.auth || req.auth.type !== 'student') {
    throw new ApiError(401, 'Not authenticated as student');
  }
  return req.auth.doc;
}

// Public-facing review shape. Allow-list so internal fields never leak.
const PUBLIC_FIELDS = [
  '_id',
  'coachingCenter',
  'student',
  'rating',
  'comment',
  'isEdited',
  'createdAt',
  'updatedAt',
] as const;

function projectReviewPublic(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

// POST /api/centers/:id/reviews — a student reviews a coaching center.
export async function create(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { id: centerId } = req.params as { id: string };
  const body = req.body as CenterReviewCreate;

  // Center must exist and be active before accepting a review.
  const center = await CoachingCenter.exists({ _id: centerId, isActive: true });
  if (!center) throw new ApiError(404, 'Coaching center not found');

  try {
    const doc = await CoachingCenterReview.create({
      coachingCenter: centerId,
      student: student._id,
      rating: body.rating,
      comment: body.comment,
    });
    res.status(201).json({ success: true, review: projectReviewPublic(doc.toObject()) });
  } catch (err) {
    // Unique (coachingCenter, student) — one review per student per center.
    if ((err as { code?: number }).code === 11000) {
      throw new ApiError(409, 'You have already reviewed this coaching center');
    }
    throw err;
  }
}

// GET /api/centers/:id/reviews — public list of a center's reviews.
export async function listForCenter(req: Request, res: Response): Promise<void> {
  const { id: centerId } = req.params as { id: string };
  const { page, limit } = req.query as unknown as CenterReviewListQuery;

  const filter = { coachingCenter: centerId };
  const [data, total] = await Promise.all([
    CoachingCenterReview.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('student', 'name profileImage')
      .lean(),
    CoachingCenterReview.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: data.map((r) => projectReviewPublic(r as Record<string, unknown>)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// PATCH /api/center-reviews/:id — author edits their own review.
export async function update(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { id } = req.params as { id: string };
  const updates = req.body as CenterReviewUpdate;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }

  const doc = await CoachingCenterReview.findById(id);
  if (!doc) throw new ApiError(404, 'Review not found');
  if (String(doc.student) !== String(student._id)) {
    throw new ApiError(403, 'Not your review');
  }

  Object.assign(doc, updates);
  doc.isEdited = true;
  await doc.save(); // triggers recalcStats via post('save')
  res.status(200).json({ success: true, review: projectReviewPublic(doc.toObject()) });
}

// DELETE /api/center-reviews/:id — author deletes their own review.
export async function remove(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { id } = req.params as { id: string };

  const doc = await CoachingCenterReview.findById(id);
  if (!doc) throw new ApiError(404, 'Review not found');
  if (String(doc.student) !== String(student._id)) {
    throw new ApiError(403, 'Not your review');
  }

  // findOneAndDelete triggers the recalcStats hook (post('findOneAndDelete')).
  await CoachingCenterReview.findOneAndDelete({ _id: id });
  res.status(204).end();
}
