import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import protect from '../middleware/protect.js';
import requireRole from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.js';
import {
  centerCreateSchema,
  centerUpdateSchema,
  centerListQuerySchema,
} from '../schemas/centers.schemas.js';
import {
  create,
  list,
  getMine,
  getById,
  update,
  remove,
} from '../controllers/centers.controller.js';

const router = Router();

// Public list of active centers.
router.get('/', validate(centerListQuerySchema, 'query'), asyncHandler(list));

// Owner — own center. '/me' is registered before '/:id' so it isn't captured
// as an ObjectId param.
router.get('/me', protect, requireRole('owner'), asyncHandler(getMine));
router.post('/', protect, requireRole('owner'), validate(centerCreateSchema), asyncHandler(create));

// Public center profile.
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getById));

// Owner-only mutations on their own center.
router.patch(
  '/:id',
  protect,
  requireRole('owner'),
  validate(idParamSchema, 'params'),
  validate(centerUpdateSchema),
  asyncHandler(update),
);
router.delete(
  '/:id',
  protect,
  requireRole('owner'),
  validate(idParamSchema, 'params'),
  asyncHandler(remove),
);

export default router;
