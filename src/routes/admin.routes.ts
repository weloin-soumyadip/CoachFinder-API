import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import protect from '../middleware/protect.js';
import requireRole from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.js';
import {
  ownerAdminPatchSchema,
  ownerListQuerySchema,
} from '../schemas/owners.schemas.js';
import {
  teacherAdminPatchSchema,
  teacherListQuerySchema,
} from '../schemas/teachers.schemas.js';
import {
  studentAdminPatchSchema,
  studentListQuerySchema,
} from '../schemas/students.schemas.js';
import {
  adminAdminPatchSchema,
  adminListQuerySchema,
  createAdminSchema,
} from '../schemas/admins.schemas.js';
import {
  subjectCreateSchema,
  subjectAdminPatchSchema,
  adminSubjectListQuerySchema,
} from '../schemas/subjects.schemas.js';

import * as owners from '../controllers/admin/owners.admin.controller.js';
import * as teachers from '../controllers/admin/teachers.admin.controller.js';
import * as students from '../controllers/admin/students.admin.controller.js';
import * as admins from '../controllers/admin/admins.admin.controller.js';
import * as subjects from '../controllers/admin/subjects.admin.controller.js';

const router = Router();

// Every endpoint under /api/admin/* requires an authenticated admin.
router.use(protect, requireRole('admin'));

// ─── Owners ────────────────────────────────────────────────────────
router.get('/owners', validate(ownerListQuerySchema, 'query'), asyncHandler(owners.list));
router.get('/owners/:id', validate(idParamSchema, 'params'), asyncHandler(owners.getById));
router.patch(
  '/owners/:id',
  validate(idParamSchema, 'params'),
  validate(ownerAdminPatchSchema),
  asyncHandler(owners.update),
);
router.patch(
  '/owners/:id/deactivate',
  validate(idParamSchema, 'params'),
  asyncHandler(owners.deactivate),
);
router.patch(
  '/owners/:id/activate',
  validate(idParamSchema, 'params'),
  asyncHandler(owners.activate),
);

// ─── Teachers ──────────────────────────────────────────────────────
router.get('/teachers', validate(teacherListQuerySchema, 'query'), asyncHandler(teachers.list));
router.get('/teachers/:id', validate(idParamSchema, 'params'), asyncHandler(teachers.getById));
router.patch(
  '/teachers/:id',
  validate(idParamSchema, 'params'),
  validate(teacherAdminPatchSchema),
  asyncHandler(teachers.update),
);
router.patch(
  '/teachers/:id/deactivate',
  validate(idParamSchema, 'params'),
  asyncHandler(teachers.deactivate),
);
router.patch(
  '/teachers/:id/activate',
  validate(idParamSchema, 'params'),
  asyncHandler(teachers.activate),
);

// ─── Students ──────────────────────────────────────────────────────
router.get('/students', validate(studentListQuerySchema, 'query'), asyncHandler(students.list));
router.get('/students/:id', validate(idParamSchema, 'params'), asyncHandler(students.getById));
router.patch(
  '/students/:id',
  validate(idParamSchema, 'params'),
  validate(studentAdminPatchSchema),
  asyncHandler(students.update),
);
router.patch(
  '/students/:id/deactivate',
  validate(idParamSchema, 'params'),
  asyncHandler(students.deactivate),
);
router.patch(
  '/students/:id/activate',
  validate(idParamSchema, 'params'),
  asyncHandler(students.activate),
);

// ─── Admins ────────────────────────────────────────────────────────
router.get('/admins', validate(adminListQuerySchema, 'query'), asyncHandler(admins.list));
router.post('/admins', validate(createAdminSchema), asyncHandler(admins.create));
router.get('/admins/:id', validate(idParamSchema, 'params'), asyncHandler(admins.getById));
router.patch(
  '/admins/:id',
  validate(idParamSchema, 'params'),
  validate(adminAdminPatchSchema),
  asyncHandler(admins.update),
);
router.patch(
  '/admins/:id/deactivate',
  validate(idParamSchema, 'params'),
  asyncHandler(admins.deactivate),
);
router.patch(
  '/admins/:id/activate',
  validate(idParamSchema, 'params'),
  asyncHandler(admins.activate),
);

// ─── Subjects ──────────────────────────────────────────────────────
router.get('/subjects', validate(adminSubjectListQuerySchema, 'query'), asyncHandler(subjects.list));
router.post('/subjects', validate(subjectCreateSchema), asyncHandler(subjects.create));
router.get('/subjects/:id', validate(idParamSchema, 'params'), asyncHandler(subjects.getById));
router.patch(
  '/subjects/:id',
  validate(idParamSchema, 'params'),
  validate(subjectAdminPatchSchema),
  asyncHandler(subjects.update),
);

export default router;
