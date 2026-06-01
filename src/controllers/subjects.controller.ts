import type { Request, Response } from 'express';
import ApiError from '../utils/ApiError.js';
import Subject from '../models/Subject.js';
import { escapeRegex } from '../lib/crud/escapeRegex.js';
import type { SubjectListQuery } from '../schemas/subjects.schemas.js';

// Public list — active subjects only.
export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, q, category } = req.query as unknown as SubjectListQuery;

  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
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

// Public get-by-id — 404 if missing or deactivated (don't leak existence).
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const subject = await Subject.findOne({ _id: id, isActive: true }).select('-__v');
  if (!subject) throw new ApiError(404, 'Subject not found');
  res.status(200).json({ subject });
}
