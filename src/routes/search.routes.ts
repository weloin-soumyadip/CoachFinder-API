import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import protect from '../middleware/protect.js';
import requireRole from '../middleware/requireRole.js';
import { search } from '../controllers/search.controller.js';

const router = Router();

// Student-only search surface. One endpoint; `searchType` (teacher|coaching|
// webinar) picks the entity and is validated inside the controller.
router.use(protect, requireRole('student'));

router.get('/', asyncHandler(search));

export default router;
