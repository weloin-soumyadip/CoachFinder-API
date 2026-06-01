import { Types } from 'mongoose';
import Subject from '../../models/Subject.js';
import { escapeRegex } from './escapeRegex.js';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Resolve a `subject` search value — either a 24-char ObjectId or human text
// (name/slug) — to Subject ObjectIds. Returns [] when nothing matches, so the
// caller's `$in: []` correctly yields zero results rather than erroring.
export async function resolveSubjectIds(subject: string): Promise<Types.ObjectId[]> {
  if (OBJECT_ID.test(subject)) return [new Types.ObjectId(subject)];

  const rx = new RegExp(escapeRegex(subject), 'i');
  const docs = await Subject.find({ isActive: true, $or: [{ name: rx }, { slug: rx }] })
    .select('_id')
    .lean();
  return docs.map((d) => d._id as Types.ObjectId);
}
