import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/create-order', requireAuth, paymentController.createOrder);
router.post('/verify', requireAuth, paymentController.verifyPayment);
router.post('/webhook', paymentController.handleWebhook);

export default router;
