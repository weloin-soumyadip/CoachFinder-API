import type { Request, Response } from 'express';
import Enquiry from '../models/Enquiry.js';
import CoachingCenter from '../models/CoachingCenter.js';
import Subject from '../models/Subject.js';
import ApiError from '../utils/ApiError.js';
import type { EnquiryCreate } from '../schemas/enquiries.schemas.js';

function requireStudent(req: Request) {
  if (!req.auth || req.auth.type !== 'student') {
    throw new ApiError(401, 'Not authenticated as student');
  }
  return req.auth.doc;
}

// Public-facing enquiry shape. Allow-list so internal fields never leak —
// notably `ownerNotes`, which is private to the center owner.
const PUBLIC_FIELDS = [
  '_id',
  'coachingCenter',
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
