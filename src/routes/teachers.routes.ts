import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import protect from '../middleware/protect.js';
import requireRole from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { teacherSelfPatchSchema } from '../schemas/teachers.schemas.js';
import { idParamSchema, passwordChangeSchema } from '../schemas/common.js';
import {
  teacherReviewCreateSchema,
  teacherReviewListQuerySchema,
} from '../schemas/teacherReviews.schemas.js';
import {
  sessionCreateSchema,
  sessionUpdateSchema,
  sessionListQuerySchema,
} from '../schemas/sessions.schemas.js';
import { enrollmentListQuerySchema } from '../schemas/enrollments.schemas.js';
import {
  enquiryCreateSchema,
  enquiryTeacherListQuerySchema,
  enquiryTeacherUpdateSchema,
} from '../schemas/enquiries.schemas.js';
import {
  updateMe,
  deleteMe,
  changePassword,
  getPublic,
  recordView,
} from '../controllers/teachers.controller.js';
import { getTeacherDashboard } from '../controllers/dashboard.controller.js';
import {
  create as createSession,
  list as listSessions,
  update as updateSession,
} from '../controllers/sessions.controller.js';
import { teacherStudents } from '../controllers/enrollments.controller.js';
import {
  create as createReview,
  listForTeacher as listReviews,
} from '../controllers/teacherReviews.controller.js';
import {
  createForTeacher as createTeacherEnquiry,
  teacherList as listTeacherEnquiries,
  teacherUpdate as updateTeacherEnquiry,
} from '../controllers/enquiries.controller.js';

const router = Router();

// ─── Teacher dashboard ─────────────────────────────────────────────
router.get('/dashboard', protect, requireRole('teacher'), asyncHandler(getTeacherDashboard));

// ─── Authenticated self-management ─────────────────────────────────
router.patch(
  '/me',
  protect,
  requireRole('teacher'),
  validate(teacherSelfPatchSchema),
  asyncHandler(updateMe),
);
router.delete('/me', protect, requireRole('teacher'), asyncHandler(deleteMe));
router.post(
  '/me/password',
  protect,
  requireRole('teacher'),
  validate(passwordChangeSchema),
  asyncHandler(changePassword),
);

// ─── Teacher-authored sessions/classes ─────────────────────────────
router.post(
  '/me/sessions',
  protect,
  requireRole('teacher'),
  validate(sessionCreateSchema),
  asyncHandler(createSession),
);
router.get(
  '/me/sessions',
  protect,
  requireRole('teacher'),
  validate(sessionListQuerySchema, 'query'),
  asyncHandler(listSessions),
);
router.patch(
  '/me/sessions/:id',
  protect,
  requireRole('teacher'),
  validate(idParamSchema, 'params'),
  validate(sessionUpdateSchema),
  asyncHandler(updateSession),
);

// ─── The teacher's active students (from teacher-linked enrollments) ─
router.get(
  '/me/students',
  protect,
  requireRole('teacher'),
  validate(enrollmentListQuerySchema, 'query'),
  asyncHandler(teacherStudents),
);

// ─── Enquiries addressed to the teacher ────────────────────────────
router.get(
  '/me/enquiries',
  protect,
  requireRole('teacher'),
  validate(enquiryTeacherListQuerySchema, 'query'),
  asyncHandler(listTeacherEnquiries),
);
router.patch(
  '/me/enquiries/:id',
  protect,
  requireRole('teacher'),
  validate(idParamSchema, 'params'),
  validate(enquiryTeacherUpdateSchema),
  asyncHandler(updateTeacherEnquiry),
);

// ─── Public — no auth required ─────────────────────────────────────
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getPublic));

// Record a profile view — students and coaching-center owners/admins.
router.post(
  '/:id/views',
  protect,
  requireRole('student', 'owner', 'admin'),
  validate(idParamSchema, 'params'),
  asyncHandler(recordView),
);

// Teacher reviews — public list, student-authored create.
router.get(
  '/:id/reviews',
  validate(idParamSchema, 'params'),
  validate(teacherReviewListQuerySchema, 'query'),
  asyncHandler(listReviews),
);
router.post(
  '/:id/reviews',
  protect,
  requireRole('student'),
  validate(idParamSchema, 'params'),
  validate(teacherReviewCreateSchema),
  asyncHandler(createReview),
);

// Student-authored enquiry addressed to a teacher.
router.post(
  '/:id/enquiries',
  protect,
  requireRole('student'),
  validate(idParamSchema, 'params'),
  validate(enquiryCreateSchema),
  asyncHandler(createTeacherEnquiry),
);

export default router;
