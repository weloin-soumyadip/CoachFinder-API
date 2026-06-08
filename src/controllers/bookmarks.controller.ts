import type { Request, Response } from 'express';
import StudentBookmark from '../models/StudentBookmark.js';
import Teacher from '../models/Teacher.js';
import Webinar from '../models/Webinar.js';
import CoachingCenter from '../models/CoachingCenter.js';
// Side-effect import: registers the Subject schema so the nested target populate
// (Teacher.subjects / CoachingCenter.subjectsOffered → Subject) resolves.
import '../models/Subject.js';
import ApiError from '../utils/ApiError.js';
import { projectTeacherPublic } from '../lib/crud/projectTeacherPublic.js';
import { projectCenterPublic } from '../lib/crud/projectCenterPublic.js';
import { projectWebinarPublic } from '../lib/crud/projectWebinarPublic.js';
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

// Map a fully-populated target to its public-safe projection. Each helper is an
// allow-list, so the no-leak rules live in one place per entity (teacher/center
// contact handling differs by design). A dangling ref populates to null.
function projectTarget(
  targetType: TargetType,
  target: unknown,
): Record<string, unknown> | null {
  if (!target || typeof target !== 'object') return null;
  const obj = target as Record<string, unknown>;
  switch (targetType) {
    case 'Teacher':
      return projectTeacherPublic(obj);
    case 'Webinar':
      return projectWebinarPublic(obj);
    case 'CoachingCenter':
      return projectCenterPublic(obj);
  }
}

// Shape one bookmark for the response: the populated student (own profile —
// password/__v already stripped by the populate select) plus the per-type
// projected target.
function projectBookmark(b: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: b._id,
    targetType: b.targetType,
    student: b.student ?? null,
    target: projectTarget(b.targetType as TargetType, b.target),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
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
    // Re-read populated so the 201 matches the enriched list shape.
    const populated = await StudentBookmark.findById(doc._id)
      .populate({
        path: 'target',
        populate: [
          // Polymorphic target: skip the path on models that don't have it
          // (Webinar/CoachingCenter lack `subjects`; Teacher/Webinar lack
          // `subjectsOffered`) instead of throwing StrictPopulateError.
          { path: 'subjects', select: 'name slug', strictPopulate: false }, // Teacher targets
          { path: 'subjectsOffered', select: 'name slug', strictPopulate: false }, // CoachingCenter targets
        ],
      })
      .populate('student', '-__v')
      .lean();
    res
      .status(201)
      .json({ success: true, bookmark: projectBookmark(populated as Record<string, unknown>) });
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
      .populate({
        path: 'target',
        populate: [
          // Polymorphic target: skip the path on models that don't have it
          // (Webinar/CoachingCenter lack `subjects`; Teacher/Webinar lack
          // `subjectsOffered`) instead of throwing StrictPopulateError.
          { path: 'subjects', select: 'name slug', strictPopulate: false }, // Teacher targets
          { path: 'subjectsOffered', select: 'name slug', strictPopulate: false }, // CoachingCenter targets
        ],
      })
      .populate('student', '-__v')
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
