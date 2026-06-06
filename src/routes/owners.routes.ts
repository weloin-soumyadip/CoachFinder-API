import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import protect from '../middleware/protect.js';
import requireRole from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ownerSelfPatchSchema } from '../schemas/owners.schemas.js';
import { passwordChangeSchema, idParamSchema } from '../schemas/common.js';
import {
  enrollmentCreateSchema,
  enrollmentUpdateSchema,
  enrollmentListQuerySchema,
} from '../schemas/enrollments.schemas.js';
import {
  enquiryOwnerUpdateSchema,
  enquiryOwnerListQuerySchema,
  enquiryOwnerSearchQuerySchema,
} from '../schemas/enquiries.schemas.js';
import { updateMe, deleteMe, changePassword } from '../controllers/owners.controller.js';
import { getOwnerDashboard } from '../controllers/dashboard.controller.js';
import {
  create as createEnrollment,
  list as listEnrollments,
  update as updateEnrollment,
} from '../controllers/enrollments.controller.js';
import {
  ownerList as listEnquiries,
  ownerGet as getEnquiry,
  ownerUpdate as updateEnquiry,
  ownerSearch as searchEnquiries,
} from '../controllers/enquiries.controller.js';

const router = Router();

router.get('/dashboard', protect, requireRole('owner'), asyncHandler(getOwnerDashboard));

// Owner-managed enrollments for the calling owner's center.
router.post(
  '/enrollments',
  protect,
  requireRole('owner'),
  validate(enrollmentCreateSchema),
  asyncHandler(createEnrollment),
);
router.get(
  '/enrollments',
  protect,
  requireRole('owner'),
  validate(enrollmentListQuerySchema, 'query'),
  asyncHandler(listEnrollments),
);
router.patch(
  '/enrollments/:id',
  protect,
  requireRole('owner'),
  validate(idParamSchema, 'params'),
  validate(enrollmentUpdateSchema),
  asyncHandler(updateEnrollment),
);

// Owner-side enquiry management for the calling owner's center.
router.get(
  '/enquiries',
  protect,
  requireRole('owner'),
  validate(enquiryOwnerListQuerySchema, 'query'),
  asyncHandler(listEnquiries),
);
// Search MUST be registered before '/enquiries/:id' so 'search' isn't parsed as an id.
router.get(
  '/enquiries/search',
  protect,
  requireRole('owner'),
  validate(enquiryOwnerSearchQuerySchema, 'query'),
  asyncHandler(searchEnquiries),
);
router.get(
  '/enquiries/:id',
  protect,
  requireRole('owner'),
  validate(idParamSchema, 'params'),
  asyncHandler(getEnquiry),
);
router.patch(
  '/enquiries/:id',
  protect,
  requireRole('owner'),
  validate(idParamSchema, 'params'),
  validate(enquiryOwnerUpdateSchema),
  asyncHandler(updateEnquiry),
);

router.patch(
  '/me',
  protect,
  requireRole('owner'),
  validate(ownerSelfPatchSchema),
  asyncHandler(updateMe),
);
router.delete('/me', protect, requireRole('owner'), asyncHandler(deleteMe));
router.post(
  '/me/password',
  protect,
  requireRole('owner'),
  validate(passwordChangeSchema),
  asyncHandler(changePassword),
);

export default router;
