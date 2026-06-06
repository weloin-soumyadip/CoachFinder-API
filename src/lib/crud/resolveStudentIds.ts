import { Types } from 'mongoose';
import Student from '../../models/Student.js';
import { escapeRegex } from './escapeRegex.js';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Resolve a `student` search value — either a 24-char ObjectId or human text
// (name/email) — to Student ObjectIds. Used by the owner enquiry search so the
// owner can filter by a student id OR a typed name/email. Returns [] when nothing
// matches, so the caller's `$in: []` correctly yields zero results.
//
// No `isActive` filter on purpose: an owner must still be able to find enquiries
// from a student who later deactivated their account.
export async function resolveStudentIds(student: string): Promise<Types.ObjectId[]> {
  if (OBJECT_ID.test(student)) return [new Types.ObjectId(student)];

  const rx = new RegExp(escapeRegex(student), 'i');
  const docs = await Student.find({ $or: [{ name: rx }, { email: rx }] })
    .select('_id')
    .lean();
  return docs.map((d) => d._id as Types.ObjectId);
}
