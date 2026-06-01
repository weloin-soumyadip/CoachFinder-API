import type { Request, Response } from 'express';
import ApiError from '../../utils/ApiError.js';
import Subject from '../../models/Subject.js';
import { escapeRegex } from '../../lib/crud/escapeRegex.js';
import type {
  AdminSubjectListQuery,
  SubjectAdminPatch,
  SubjectCreate,
} from '../../schemas/subjects.schemas.js';

// Mongo duplicate-key (E11000) guard — name/slug are unique on the model.
// The global handler only reshapes the `email` index, so handle subjects here.
const isDuplicateKey = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

// Admin list — all subjects, incl. inactive. `isActive` filter is optional.
export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, q, category, isActive } = req.query as unknown as AdminSubjectListQuery;

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive;
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };

  const [data, total] = await Promise.all([
    Subject.find(filter)
      .select('-__v')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Subject.countDocuments(filter),
  ]);

  res.status(200).json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const subject = await Subject.findById(id).select('-__v');
  if (!subject) throw new ApiError(404, 'Subject not found');
  res.status(200).json({ subject });
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const subject = await Subject.create(req.body as SubjectCreate);
    res.status(201).json({ subject });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ApiError(409, 'Subject already exists');
    throw err;
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const updates = req.body as SubjectAdminPatch;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }
  const doc = await Subject.findById(id);
  if (!doc) throw new ApiError(404, 'Subject not found');
  Object.assign(doc, updates);
  try {
    await doc.save();
  } catch (err) {
    if (isDuplicateKey(err)) throw new ApiError(409, 'Subject already exists');
    throw err;
  }
  res.status(200).json({ subject: doc });
}
