import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import protect from '../middleware/protect.js';
import requireRole from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { ownerSelfPatchSchema } from '../schemas/owners.schemas.js';
import { passwordChangeSchema } from '../schemas/common.js';
import { updateMe, deleteMe, changePassword } from '../controllers/owners.controller.js';
import { getOwnerDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/dashboard', protect, requireRole('owner'), asyncHandler(getOwnerDashboard));

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
