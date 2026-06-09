import type { Request, Response } from 'express';
import ApiError from '../utils/ApiError.js';
import Teacher from '../models/Teacher.js';
import TeacherProfileView from '../models/TeacherProfileView.js';
import { issueAccess } from '../lib/auth/jwt.js';
import { issueNewRefresh, revokeAllForUser } from '../lib/auth/refreshTokens.js';
import { setRefreshCookie, clearRefreshCookie } from '../lib/auth/cookies.js';
import { sanitize } from '../lib/auth/sanitize.js';
import { projectTeacherPublic } from '../lib/crud/projectTeacherPublic.js';
import type { TeacherSelfPatch } from '../schemas/teachers.schemas.js';
import type { PasswordChange } from '../schemas/common.js';
import type { AuthTokenResponse } from '../types/auth-response.js';

function requireTeacher(req: Request) {
  if (!req.auth || req.auth.type !== 'teacher') {
    throw new ApiError(401, 'Not authenticated as teacher');
  }
  return req.auth.doc;
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const doc = requireTeacher(req);
  const updates = req.body as TeacherSelfPatch;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'no fields to update');
  }
  Object.assign(doc, updates);
  await doc.save();
  res.status(200).json({ user: sanitize(doc) });
}

export async function deleteMe(req: Request, res: Response): Promise<void> {
  const doc = requireTeacher(req);
  doc.isActive = false;
  await doc.save();
  await revokeAllForUser(String(doc._id));
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const doc = requireTeacher(req);
  const { currentPassword, newPassword } = req.body as PasswordChange;

  const withPassword = await Teacher.findById(doc._id).select('+password');
  if (!withPassword) throw new ApiError(401, 'Account no longer exists');

  const ok = await withPassword.comparePassword(currentPassword);
  if (!ok) throw new ApiError(401, 'Invalid current password');

  withPassword.password = newPassword;
  await withPassword.save();

  const sub = String(withPassword._id);
  await revokeAllForUser(sub);

  const accessToken = issueAccess({ sub, userType: 'teacher' });
  const refresh = await issueNewRefresh(sub, 'teacher');
  setRefreshCookie(res, refresh);

  const payload: AuthTokenResponse = {
    success: true,
    accessToken,
    refreshToken: refresh.token,
  };
  res.status(200).json(payload);
}

// Public teacher profile — no auth required. 404 on missing OR deactivated
// so we don't leak the existence of soft-deleted accounts.
export async function getPublic(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const doc = await Teacher.findOne({ _id: id, isActive: true });
  if (!doc) throw new ApiError(404, 'Teacher not found');
  res.status(200).json({ teacher: projectTeacherPublic(doc) });
}

// POST /api/teachers/:id/views — record a view of this teacher's profile.
// Auth required; students and coaching-center owners/admins may record a view
// (enforced by requireRole on the route), so the viewer is always attributed.
// Raw event, no dedupe — the dashboard counts these. Feeds dashboard.profileViews.
const VIEWER_TYPES = { student: 'Student', owner: 'Owner', admin: 'Admin' } as const;

export async function recordView(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  const exists = await Teacher.exists({ _id: id, isActive: true });
  if (!exists) throw new ApiError(404, 'Teacher not found');

  const authType = req.auth?.type;
  if (authType !== 'student' && authType !== 'owner' && authType !== 'admin') {
    throw new ApiError(403, 'Only students and owners/admins can record a view');
  }
  await TeacherProfileView.create({
    teacher: id,
    viewer: req.auth!.doc._id,
    viewerType: VIEWER_TYPES[authType],
  });

  res.status(201).json({ success: true });
}
