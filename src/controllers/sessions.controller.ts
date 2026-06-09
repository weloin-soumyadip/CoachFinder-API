import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import Session from '../models/Session.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';
import ApiError from '../utils/ApiError.js';
import type {
  SessionCreate,
  SessionUpdate,
  SessionListQuery,
} from '../schemas/sessions.schemas.js';

function requireTeacher(req: Request) {
  if (!req.auth || req.auth.type !== 'teacher') {
    throw new ApiError(401, 'Not authenticated as teacher');
  }
  return req.auth.doc;
}

function populated(id: Types.ObjectId | string) {
  return Session.findById(id)
    .populate('subject', 'name')
    .populate('student', 'name phone email')
    .lean();
}

// today's [start, end) in UTC — used by the optional ?date= list filter.
function dayRange(date: Date): { $gte: Date; $lt: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { $gte: start, $lt: end };
}

// POST /api/teachers/me/sessions — teacher schedules a session/class.
export async function create(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const body = req.body as SessionCreate;

  if (body.subject) {
    const subject = await Subject.exists({ _id: body.subject, isActive: true });
    if (!subject) throw new ApiError(404, 'Subject not found');
  }
  if (body.student) {
    const student = await Student.exists({ _id: body.student, isActive: true });
    if (!student) throw new ApiError(404, 'Student not found');
  }

  const doc = await Session.create({
    teacher: teacher._id,
    title: body.title,
    coachingCenter: body.coachingCenter,
    subject: body.subject,
    student: body.student,
    scheduledAt: body.scheduledAt,
    durationMinutes: body.durationMinutes,
    status: body.status ?? 'scheduled',
  });

  res.status(201).json({ success: true, session: await populated(doc._id) });
}

// GET /api/teachers/me/sessions — the teacher's sessions, soonest first.
export async function list(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const { page, limit, status, date } = req.query as unknown as SessionListQuery;

  const filter: Record<string, unknown> = { teacher: teacher._id, isActive: true };
  if (status) filter.status = status;
  if (date) filter.scheduledAt = dayRange(date);

  const [data, total] = await Promise.all([
    Session.find(filter)
      .sort({ scheduledAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('subject', 'name')
      .populate('student', 'name phone email')
      .lean(),
    Session.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// PATCH /api/teachers/me/sessions/:id — owner-only edit (reschedule / status).
export async function update(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const { id } = req.params as { id: string };
  const updates = req.body as SessionUpdate;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }

  const doc = await Session.findById(id);
  if (!doc) throw new ApiError(404, 'Session not found');
  if (String(doc.teacher) !== String(teacher._id)) {
    throw new ApiError(403, 'Not your session');
  }

  if (updates.subject) {
    const subject = await Subject.exists({ _id: updates.subject, isActive: true });
    if (!subject) throw new ApiError(404, 'Subject not found');
  }
  if (updates.student) {
    const student = await Student.exists({ _id: updates.student, isActive: true });
    if (!student) throw new ApiError(404, 'Student not found');
  }

  Object.assign(doc, updates);
  await doc.save();

  res.status(200).json({ success: true, session: await populated(doc._id) });
}
