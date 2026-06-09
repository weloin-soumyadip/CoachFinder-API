import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import Enquiry from '../models/Enquiry.js';
import CoachingCenter from '../models/CoachingCenter.js';
import Subject from '../models/Subject.js';
import Teacher from '../models/Teacher.js';
import ApiError from '../utils/ApiError.js';
import { escapeRegex } from '../lib/crud/escapeRegex.js';
import { resolveSubjectIds } from '../lib/crud/resolveSubjectIds.js';
import { resolveStudentIds } from '../lib/crud/resolveStudentIds.js';
import type {
  EnquiryCreate,
  EnquiryOwnerUpdate,
  EnquiryOwnerListQuery,
  EnquiryStudentListQuery,
  EnquiryOwnerSearchQuery,
  EnquiryStudentSearchQuery,
  EnquiryTeacherListQuery,
  EnquiryTeacherUpdate,
} from '../schemas/enquiries.schemas.js';

function requireStudent(req: Request) {
  if (!req.auth || req.auth.type !== 'student') {
    throw new ApiError(401, 'Not authenticated as student');
  }
  return req.auth.doc;
}

function requireOwner(req: Request) {
  if (!req.auth || req.auth.type !== 'owner') {
    throw new ApiError(401, 'Not authenticated as owner');
  }
  return req.auth.doc;
}

function requireTeacher(req: Request) {
  if (!req.auth || req.auth.type !== 'teacher') {
    throw new ApiError(401, 'Not authenticated as teacher');
  }
  return req.auth.doc;
}

// One owner = one center. Resolve it from the token (same as the dashboard).
async function resolveOwnerCenter(ownerId: Types.ObjectId): Promise<Types.ObjectId> {
  const center = await CoachingCenter.findOne({ owner: ownerId }).select('_id').lean();
  if (!center) throw new ApiError(404, 'No coaching center found for this owner');
  return center._id as Types.ObjectId;
}

// Owner-facing populate: the owner sees the full enquiry incl. `ownerNotes`,
// with the enquiring student's contact and the subject name.
function populatedForOwner(id: Types.ObjectId | string) {
  return Enquiry.findById(id)
    .populate('student', 'name phone email')
    .populate('subject', 'name')
    .lean();
}

// Public-facing enquiry shape. Allow-list so internal fields never leak —
// notably `ownerNotes`, which is private to the center owner / teacher.
const PUBLIC_FIELDS = [
  '_id',
  'coachingCenter',
  'teacher',
  'student',
  'subject',
  'message',
  'status',
  'createdAt',
] as const;

function projectEnquiryPublic(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

// POST /api/centers/:id/enquiries — a student sends an enquiry to a center.
export async function create(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { id: centerId } = req.params as { id: string };
  const body = req.body as EnquiryCreate;

  // Center must exist and be active before accepting an enquiry.
  const center = await CoachingCenter.exists({ _id: centerId, isActive: true });
  if (!center) throw new ApiError(404, 'Coaching center not found');

  if (body.subject) {
    const subject = await Subject.exists({ _id: body.subject, isActive: true });
    if (!subject) throw new ApiError(404, 'Subject not found');
  }

  const doc = await Enquiry.create({
    coachingCenter: centerId,
    student: student._id,
    message: body.message,
    subject: body.subject,
  });

  res.status(201).json({ success: true, enquiry: projectEnquiryPublic(doc.toObject()) });
}

// POST /api/teachers/:id/enquiries — a student sends an enquiry to a teacher.
// No coaching center — this enquiry is addressed to the teacher directly and
// feeds the teacher dashboard's "recent enquiries".
export async function createForTeacher(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { id: teacherId } = req.params as { id: string };
  const body = req.body as EnquiryCreate;

  const teacher = await Teacher.exists({ _id: teacherId, isActive: true });
  if (!teacher) throw new ApiError(404, 'Teacher not found');

  if (body.subject) {
    const subject = await Subject.exists({ _id: body.subject, isActive: true });
    if (!subject) throw new ApiError(404, 'Subject not found');
  }

  const doc = await Enquiry.create({
    teacher: teacherId,
    student: student._id,
    message: body.message,
    subject: body.subject,
  });

  res.status(201).json({ success: true, enquiry: projectEnquiryPublic(doc.toObject()) });
}

// GET /api/teachers/me/enquiries — teacher lists enquiries addressed to them.
export async function teacherList(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const { page, limit, status } = req.query as unknown as EnquiryTeacherListQuery;

  const filter: Record<string, unknown> = { teacher: teacher._id };
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('student', 'name phone email')
      .populate('subject', 'name')
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  // Teacher-scoped, so the full doc (incl. their ownerNotes) is returned as-is.
  res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// PATCH /api/teachers/me/enquiries/:id — teacher updates status and/or notes.
export async function teacherUpdate(req: Request, res: Response): Promise<void> {
  const teacher = requireTeacher(req);
  const { id } = req.params as { id: string };
  const updates = req.body as EnquiryTeacherUpdate;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }

  const doc = await Enquiry.findById(id);
  if (!doc) throw new ApiError(404, 'Enquiry not found');
  if (String(doc.teacher) !== String(teacher._id)) {
    throw new ApiError(403, 'Not your enquiry');
  }

  Object.assign(doc, updates);
  await doc.save();

  res.status(200).json({
    success: true,
    enquiry: await Enquiry.findById(doc._id)
      .populate('student', 'name phone email')
      .populate('subject', 'name')
      .lean(),
  });
}

// GET /api/owners/enquiries — owner lists enquiries for their center, newest first.
export async function ownerList(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const centerId = await resolveOwnerCenter(owner._id);
  const { page, limit, status } = req.query as unknown as EnquiryOwnerListQuery;

  const filter: Record<string, unknown> = { coachingCenter: centerId };
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('student', 'name phone email')
      .populate('subject', 'name')
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  // Owner-scoped, so the full doc (incl. ownerNotes) is returned as-is.
  res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// GET /api/owners/enquiries/:id — owner reads one enquiry in full.
export async function ownerGet(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const centerId = await resolveOwnerCenter(owner._id);
  const { id } = req.params as { id: string };

  const doc = await Enquiry.findById(id).select('coachingCenter').lean();
  if (!doc) throw new ApiError(404, 'Enquiry not found');
  if (String(doc.coachingCenter) !== String(centerId)) {
    throw new ApiError(403, 'Not your enquiry');
  }

  res.status(200).json({ success: true, enquiry: await populatedForOwner(id) });
}

// PATCH /api/owners/enquiries/:id — owner updates status and/or ownerNotes.
export async function ownerUpdate(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const centerId = await resolveOwnerCenter(owner._id);
  const { id } = req.params as { id: string };
  const updates = req.body as EnquiryOwnerUpdate;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }

  const doc = await Enquiry.findById(id);
  if (!doc) throw new ApiError(404, 'Enquiry not found');
  if (String(doc.coachingCenter) !== String(centerId)) {
    throw new ApiError(403, 'Not your enquiry');
  }

  Object.assign(doc, updates);
  await doc.save();

  res.status(200).json({ success: true, enquiry: await populatedForOwner(doc._id) });
}

// GET /api/students/enquiries — a student lists the enquiries they have sent.
export async function studentList(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { page, limit, status } = req.query as unknown as EnquiryStudentListQuery;

  const filter: Record<string, unknown> = { student: student._id };
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('coachingCenter', 'name')
      .populate('subject', 'name')
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  // Project through the allow-list so `ownerNotes` is never exposed to students.
  res.status(200).json({
    success: true,
    data: data.map((e) => projectEnquiryPublic(e as Record<string, unknown>)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// Build a Mongo createdAt range from optional dateFrom/dateTo bounds.
function createdAtRange(dateFrom?: Date, dateTo?: Date): Record<string, Date> | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const range: Record<string, Date> = {};
  if (dateFrom) range.$gte = dateFrom;
  if (dateTo) range.$lte = dateTo;
  return range;
}

// GET /api/owners/enquiries/search — owner searches enquiries of THEIR center by
// keyword (message + ownerNotes), status, subject (id/name), student (id/name/email),
// and createdAt range. Always scoped to the owner's one center.
export async function ownerSearch(req: Request, res: Response): Promise<void> {
  const owner = requireOwner(req);
  const centerId = await resolveOwnerCenter(owner._id);
  const { page, limit, q, status, subject, student, dateFrom, dateTo } =
    req.query as unknown as EnquiryOwnerSearchQuery;

  const filter: Record<string, unknown> = { coachingCenter: centerId };
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ message: rx }, { ownerNotes: rx }];
  }
  if (status) filter.status = status;
  if (subject) filter.subject = { $in: await resolveSubjectIds(subject) };
  if (student) filter.student = { $in: await resolveStudentIds(student) };
  const range = createdAtRange(dateFrom, dateTo);
  if (range) filter.createdAt = range;

  const [data, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('student', 'name phone email')
      .populate('subject', 'name')
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  // Owner-scoped, so the full doc (incl. ownerNotes) is returned as-is.
  res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

// GET /api/students/enquiries/search — student searches THEIR OWN enquiries by
// keyword (message only), status, subject (id/name), and createdAt range.
export async function studentSearch(req: Request, res: Response): Promise<void> {
  const student = requireStudent(req);
  const { page, limit, q, status, subject, dateFrom, dateTo } =
    req.query as unknown as EnquiryStudentSearchQuery;

  const filter: Record<string, unknown> = { student: student._id };
  // Keyword matches the message only — ownerNotes stays private to the owner.
  if (q) filter.message = { $regex: escapeRegex(q), $options: 'i' };
  if (status) filter.status = status;
  if (subject) filter.subject = { $in: await resolveSubjectIds(subject) };
  const range = createdAtRange(dateFrom, dateTo);
  if (range) filter.createdAt = range;

  const [data, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('coachingCenter', 'name')
      .populate('subject', 'name')
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  // Project through the allow-list so `ownerNotes` is never exposed to students.
  res.status(200).json({
    success: true,
    data: data.map((e) => projectEnquiryPublic(e as Record<string, unknown>)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}
