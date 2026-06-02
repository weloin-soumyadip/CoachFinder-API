import type { Request, Response } from 'express';
import Webinar from '../models/Webinar.js';
import ApiError from '../utils/ApiError.js';
import type {
  WebinarCreate,
  WebinarUpdate,
  WebinarListQuery,
} from '../schemas/webinars.schemas.js';
import { projectWebinarPublic } from '../lib/crud/projectWebinarPublic.js';

function requireTeacher(req: Request) {
  if (!req.auth || req.auth.type !== 'teacher') {
    throw new ApiError(401, 'Not authenticated as teacher');
  }
  return req.auth.doc;
}

// POST /api/webinars — teacher authors a webinar they host.
export async function create(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const body = req.body as WebinarCreate;
  const doc = await Webinar.create({ ...body, teacher: teacher._id });
  res.status(201).json({ success: true, webinar: projectWebinarPublic(doc.toObject()) });
}

// GET /api/webinars — public list with pagination + filters.
export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, teacher, status, upcoming } = req.query as unknown as WebinarListQuery;

  const filter: Record<string, unknown> = { isActive: true };
  if (teacher) filter.teacher = teacher;
  if (status) filter.status = status;
  if (upcoming) filter.scheduledAt = { $gte: new Date() };

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

// GET /api/webinars/:id — public detail.
export async function getOne(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const doc = await Webinar.findOne({ _id: id, isActive: true })
    .populate('teacher', 'name profileImage')
    .lean();
  if (!doc) throw new ApiError(404, 'Webinar not found');
  res.status(200).json({ success: true, webinar: projectWebinarPublic(doc as Record<string, unknown>) });
}

// PATCH /api/webinars/:id — teacher edits their own webinar.
export async function update(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const { id } = req.params as { id: string };
  const updates = req.body as WebinarUpdate;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }

  const doc = await Webinar.findOne({ _id: id, isActive: true });
  if (!doc) throw new ApiError(404, 'Webinar not found');
  if (String(doc.teacher) !== String(teacher._id)) {
    throw new ApiError(403, 'Not your webinar');
  }

  Object.assign(doc, updates);
  await doc.save();
  res.status(200).json({ success: true, webinar: projectWebinarPublic(doc.toObject()) });
}

// DELETE /api/webinars/:id — soft-delete (isActive=false) by the owning teacher.
export async function remove(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const { id } = req.params as { id: string };

  const doc = await Webinar.findOne({ _id: id, isActive: true });
  if (!doc) throw new ApiError(404, 'Webinar not found');
  if (String(doc.teacher) !== String(teacher._id)) {
    throw new ApiError(403, 'Not your webinar');
  }

  doc.isActive = false;
  await doc.save();
  res.status(204).end();
}
