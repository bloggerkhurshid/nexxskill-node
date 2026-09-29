import { Router } from 'express';
import * as couponController from '../controllers/couponController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/validate', requireAuth, couponController.validateCoupon);

export default router;
