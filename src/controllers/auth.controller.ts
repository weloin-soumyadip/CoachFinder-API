import type { Request, Response } from 'express';
import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';
import { issueAccess, type UserType } from '../lib/auth/jwt.js';
import {
  issueNewRefresh,
  rotateRefresh,
  revokeRefresh,
} from '../lib/auth/refreshTokens.js';
import { setRefreshCookie, clearRefreshCookie } from '../lib/auth/cookies.js';
import { sanitize, type AuthDoc } from '../lib/auth/sanitize.js';
import { assertEmailAvailable } from '../lib/auth/emailUniqueness.js';
import type {
  AuthIdentityResponse,
  AuthTokenResponse,
} from '../types/auth-response.js';
import Owner from '../models/Owner.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import Admin, { type AdminDoc } from '../models/Admin.js';
import type { AuthUser } from '../types/express.js';

type RegisterableUserType = Exclude<UserType, 'admin'>;

const REGISTERABLE: ReadonlyArray<RegisterableUserType> = ['owner', 'teacher', 'student'];
const ALL_TYPES: ReadonlyArray<UserType> = ['owner', 'teacher', 'student', 'admin'];

export async function register(req: Request, res: Response): Promise<void> {
  const { userType, name, email, password, phone } = req.body as Partial<{
    userType: string;
    name: string;
    email: string;
    password: string;
    phone: string;
  }>;

  if (!userType || !REGISTERABLE.includes(userType as RegisterableUserType)) {
    throw new ApiError(400, `userType must be one of: ${REGISTERABLE.join(', ')}`);
  }
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email, and password are required');
  }

  await assertEmailAvailable(email);

  let doc: AuthDoc;
  const base = { name, email, password, ...(phone ? { phone } : {}) };
  switch (userType as RegisterableUserType) {
    case 'owner':
      doc = await Owner.create(base);
      break;
    case 'teacher':
      doc = await Teacher.create(base);
      break;
    case 'student':
      doc = await Student.create(base);
      break;
  }

  const sub = String(doc._id);
  const typed = userType as UserType;
  const accessToken = issueAccess({ sub, userType: typed });
  const refresh = await issueNewRefresh(sub, typed);
  setRefreshCookie(res, refresh);

  const payload: AuthTokenResponse = {
    success: true,
    accessToken,
    refreshToken: refresh.token,
    user: sanitize(doc),
  };
  res.status(201).json(payload);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { userType, email, password } = req.body as Partial<{
    userType: string;
    email: string;
    password: string;
  }>;

  if (!userType || !ALL_TYPES.includes(userType as UserType)) {
    throw new ApiError(400, `userType must be one of: ${ALL_TYPES.join(', ')}`);
  }
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const normalized = email.toLowerCase().trim();
  const doc = await loadWithPassword(userType as UserType, normalized);
  if (!doc) throw new ApiError(401, 'Invalid credentials');
  if (!doc.isActive) throw new ApiError(401, 'Account is deactivated');

  const ok = await doc.comparePassword(password);
  if (!ok) throw new ApiError(401, 'Invalid credentials');

  if (userType === 'admin') {
    (doc as AdminDoc).lastLoginAt = new Date();
    await doc.save();
  }

  const sub = String(doc._id);
  const typed = userType as UserType;
  const accessToken = issueAccess({ sub, userType: typed });
  const refresh = await issueNewRefresh(sub, typed);
  setRefreshCookie(res, refresh);

  const payload: AuthTokenResponse = {
    success: true,
    accessToken,
    refreshToken: refresh.token,
    user: sanitize(doc),
  };
  res.status(200).json(payload);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  // Accept the refresh token from the request body OR the HttpOnly cookie.
  // Browser SPAs on a different origin can't reliably persist/send the cookie
  // (SameSite + no Secure over http), so non-cookie clients send it in the body
  // (it's already returned to them in the login/refresh response).
  const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const raw = bodyToken || cookies[config.cookie.refreshName];
  if (!raw) throw new ApiError(401, 'Missing refresh token');

  let rotated;
  try {
    rotated = await rotateRefresh(raw);
  } catch {
    // rotation failed: bad signature, expired, missing in Redis, or family revoked.
    clearRefreshCookie(res);
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const accessToken = issueAccess({ sub: rotated.sub, userType: rotated.userType });
  setRefreshCookie(res, rotated);
  const payload: AuthTokenResponse = {
    success: true,
    accessToken,
    refreshToken: rotated.token,
  };
  res.status(200).json(payload);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const raw = bodyToken || cookies[config.cookie.refreshName];
  if (raw) {
    await revokeRefresh(raw);
  }
  clearRefreshCookie(res);
  res.status(204).end();
}

async function loadWithPassword(
  userType: UserType,
  email: string,
): Promise<AuthDoc | null> {
  // Cast per-branch because Mongoose's HydratedDocument is invariant in its
  // attrs; a union of four distinct doc shapes cannot accept any single one
  // by direct return. Runtime safety is guaranteed by the userType switch.
  switch (userType) {
    case 'owner':
      return (await Owner.findOne({ email }).select('+password')) as AuthDoc | null;
    case 'teacher':
      return (await Teacher.findOne({ email }).select('+password')) as AuthDoc | null;
    case 'student':
      return (await Student.findOne({ email }).select('+password')) as AuthDoc | null;
    case 'admin':
      return (await Admin.findOne({ email }).select('+password')) as AuthDoc | null;
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new ApiError(401, 'Not authenticated');
  // Discriminate so TS narrows the doc type and `sanitize` accepts it.
  const auth: AuthUser = req.auth;
  const payload: AuthIdentityResponse = {
    success: true,
    userType: auth.type,
    user: sanitize(auth.doc),
  };
  res.status(200).json(payload);
}
