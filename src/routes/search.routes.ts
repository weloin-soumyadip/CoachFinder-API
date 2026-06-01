import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import protect from '../middleware/protect.js';
import requireRole from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  teacherSearchQuerySchema,
  centerSearchQuerySchema,
} from '../schemas/search.schemas.js';
import { searchTeachers, searchCenters } from '../controllers/search.controller.js';

const router = Router();

// Student-only search surface.
router.use(protect, requireRole('student'));

router.get('/teachers', validate(teacherSearchQuerySchema, 'query'), asyncHandler(searchTeachers));
router.get('/centers', validate(centerSearchQuerySchema, 'query'), asyncHandler(searchCenters));

export default router;
