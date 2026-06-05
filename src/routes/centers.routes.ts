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
  centerReviewCreateSchema,
  centerReviewListQuerySchema,
} from '../schemas/centerReviews.schemas.js';
import { enquiryCreateSchema } from '../schemas/enquiries.schemas.js';
import {
  create,
  list,
  getMine,
  getById,
  recordView,
  update,
  remove,
} from '../controllers/centers.controller.js';
import {
  create as createReview,
  listForCenter as listReviews,
} from '../controllers/centerReviews.controller.js';
import { create as createEnquiry } from '../controllers/enquiries.controller.js';

const router = Router();

// Public list of active centers.
router.get('/', validate(centerListQuerySchema, 'query'), asyncHandler(list));

// Owner — own center. '/me' is registered before '/:id' so it isn't captured
// as an ObjectId param.
router.get('/me', protect, requireRole('owner'), asyncHandler(getMine));
router.post('/', protect, requireRole('owner'), validate(centerCreateSchema), asyncHandler(create));

// Public center profile.
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getById));

// Record a profile view — authenticated students & teachers only.
router.post(
  '/:id/views',
  protect,
  requireRole('teacher', 'student'),
  validate(idParamSchema, 'params'),
  asyncHandler(recordView),
);

// Center reviews — public list, student-authored create.
router.get(
  '/:id/reviews',
  validate(idParamSchema, 'params'),
  validate(centerReviewListQuerySchema, 'query'),
  asyncHandler(listReviews),
);
router.post(
  '/:id/reviews',
  protect,
  requireRole('student'),
  validate(idParamSchema, 'params'),
  validate(centerReviewCreateSchema),
  asyncHandler(createReview),
);

// Student-authored enquiry to a center.
router.post(
  '/:id/enquiries',
  protect,
  requireRole('student'),
  validate(idParamSchema, 'params'),
  validate(enquiryCreateSchema),
  asyncHandler(createEnquiry),
);

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
