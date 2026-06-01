import type { Request, Response } from 'express';
import StudentBookmark from '../models/StudentBookmark.js';
import Teacher from '../models/Teacher.js';
import Webinar from '../models/Webinar.js';
import CoachingCenter from '../models/CoachingCenter.js';
import ApiError from '../utils/ApiError.js';
import type { BookmarkCreate, BookmarkListQuery } from '../schemas/bookmarks.schemas.js';

type TargetType = BookmarkCreate['targetType'];

function requireStudent(req: Request) {
  if (!req.auth || req.auth.type !== 'student') {
    throw new ApiError(401, 'Not authenticated as student');
  }
  return req.auth.doc;
}

// Existence + active check against the right collection. A switch (not a model
// map) keeps each call concretely typed and the union exhaustive.
async function targetExists(targetType: TargetType, id: string): Promise<boolean> {
  const filter = { _id: id, isActive: true };
  switch (targetType) {
    case 'Teacher':
      return (await Teacher.exists(filter)) !== null;
    case 'Webinar':
      return (await Webinar.exists(filter)) !== null;
    case 'CoachingCenter':
      return (await CoachingCenter.exists(filter)) !== null;
  }
}

// Union allow-list select for the polymorphic populate. Mongo ignores keys not
// present on a given model, so this safely covers all three target types while
// deliberately excluding teacher/center contact info (email/phone).
const TARGET_SELECT =
  'name profileImage averageRating totalReviews isVerified slug city area ' +
  'title scheduledAt durationMinutes thumbnail joinUrl status';

const PUBLIC_FIELDS = ['_id', 'targetType', 'target', 'createdAt', 'updatedAt'] as const;
function projectBookmark(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

// POST /api/students/bookmarks — save a teacher / webinar / coaching center.
export async function createBookmark(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { targetType, targetId } = req.body as BookmarkCreate;

  if (!(await targetExists(targetType, targetId))) {
    throw new ApiError(404, `${targetType} not found`);
  }

  try {
    const doc = await StudentBookmark.create({
      student: student._id,
      targetType,
      target: targetId,
    });
    res.status(201).json({ success: true, bookmark: projectBookmark(doc.toObject()) });
  } catch (err) {
    // Unique (student, targetType, target) — already saved.
    if ((err as { code?: number }).code === 11000) {
      throw new ApiError(409, 'Already bookmarked');
    }
    throw err;
  }
}

// GET /api/students/bookmarks — the caller's bookmarks, newest first.
export async function listBookmarks(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { page, limit, targetType } = req.query as unknown as BookmarkListQuery;

  const filter: Record<string, unknown> = { student: student._id };
  if (targetType) filter.targetType = targetType;

  const [data, total] = await Promise.all([
    StudentBookmark.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('target', TARGET_SELECT)
      .lean(),
    StudentBookmark.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: data.map((b) => projectBookmark(b as Record<string, unknown>)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// DELETE /api/students/bookmarks/:id — remove one of the caller's bookmarks.
export async function removeBookmark(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { id } = req.params as { id: string };

  const doc = await StudentBookmark.findById(id);
  if (!doc) throw new ApiError(404, 'Bookmark not found');
  if (String(doc.student) !== String(student._id)) {
    throw new ApiError(403, 'Not your bookmark');
  }

  await StudentBookmark.findOneAndDelete({ _id: id });
  res.status(204).end();
}
