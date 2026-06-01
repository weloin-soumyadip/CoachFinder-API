import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.js';
import { subjectListQuerySchema } from '../schemas/subjects.schemas.js';
import { list, getById } from '../controllers/subjects.controller.js';

const router = Router();

// Public reads — active subjects only.
router.get('/', validate(subjectListQuerySchema, 'query'), asyncHandler(list));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getById));

export default router;
