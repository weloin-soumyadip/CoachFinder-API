import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import Enrollment from '../models/Enrollment.js';
import CoachingCenter from '../models/CoachingCenter.js';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';
import ApiError from '../utils/ApiError.js';
import type {
  EnrollmentCreate,
  EnrollmentUpdate,
  EnrollmentListQuery,
} from '../schemas/enrollments.schemas.js';

const TERMINAL = ['completed', 'cancelled', 'expired'] as const;
function isTerminal(status: string): boolean {
  return (TERMINAL as readonly string[]).includes(status);
}

function requireOwner(req: Request) {
  if (!req.auth || req.auth.type !== 'owner') {
    throw new ApiError(401, 'Not authenticated as owner');
  }
  return req.auth.doc;
}

// One owner = one center. Resolve it from the token (same as the dashboard).
async function resolveOwnerCenter(ownerId: Types.ObjectId): Promise<Types.ObjectId> {
  const center = await CoachingCenter.findOne({ owner: ownerId }).select('_id').lean();
  if (!center) throw new ApiError(404, 'No coaching center found for this owner');
  return center._id as Types.ObjectId;
}

function populated(id: Types.ObjectId | string) {
  return Enrollment.findById(id)
    .populate('student', 'name phone email')
    .populate('subject', 'name')
    .lean();
}

// POST /api/owners/enrollments — owner enrolls a student at their center.
export async function create(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const centerId = await resolveOwnerCenter(owner._id);
  const body = req.body as EnrollmentCreate;

  const student = await Student.exists({ _id: body.studentId, isActive: true });
  if (!student) throw new ApiError(404, 'Student not found');

  if (body.subject) {
    const subject = await Subject.exists({ _id: body.subject, isActive: true });
    if (!subject) throw new ApiError(404, 'Subject not found');
  }

  const status = body.status ?? 'active';
  if (status === 'active') {
    const existing = await Enrollment.exists({
      coachingCenter: centerId,
      student: body.studentId,
      status: 'active',
    });
    if (existing) throw new ApiError(409, 'Student already actively enrolled');
  }

  const doc = await Enrollment.create({
    coachingCenter: centerId,
    student: body.studentId,
    subject: body.subject,
    status,
    endedAt: isTerminal(status) ? new Date() : undefined,
  });

  res.status(201).json({ success: true, enrollment: await populated(doc._id) });
}

// GET /api/owners/enrollments — list the owner's center enrollments, newest first.
export async function list(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const centerId = await resolveOwnerCenter(owner._id);
  const { page, limit, status } = req.query as unknown as EnrollmentListQuery;

  const filter: Record<string, unknown> = { coachingCenter: centerId };
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ enrolledAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('student', 'name phone email')
      .populate('subject', 'name')
      .lean(),
    Enrollment.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// PATCH /api/owners/enrollments/:id — owner updates status/subject of an enrollment.
export async function update(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const centerId = await resolveOwnerCenter(owner._id);
  const { id } = req.params as { id: string };
  const updates = req.body as EnrollmentUpdate;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }

  const doc = await Enrollment.findById(id);
  if (!doc) throw new ApiError(404, 'Enrollment not found');
  if (String(doc.coachingCenter) !== String(centerId)) {
    throw new ApiError(403, 'Not your enrollment');
  }

  if (updates.subject) {
    const subject = await Subject.exists({ _id: updates.subject, isActive: true });
    if (!subject) throw new ApiError(404, 'Subject not found');
  }

  if (updates.status) {
    if (updates.status === 'active') {
      // Re-activating: ensure no other active row for this student exists.
      const existing = await Enrollment.exists({
        _id: { $ne: doc._id },
        coachingCenter: centerId,
        student: doc.student,
        status: 'active',
      });
      if (existing) throw new ApiError(409, 'Student already actively enrolled');
      doc.endedAt = undefined;
    } else if (isTerminal(updates.status)) {
      doc.endedAt = new Date();
    }
  }

  Object.assign(doc, updates);
  await doc.save();

  res.status(200).json({ success: true, enrollment: await populated(doc._id) });
}
