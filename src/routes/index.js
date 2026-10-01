import { Router } from 'express';
import authRoutes from './authRoutes.js';
import courseRoutes from './courseRoutes.js';
import leadRoutes from './leadRoutes.js';
import studentRoutes from './studentRoutes.js';
import couponRoutes from './couponRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import adminRoutes from './adminRoutes.js';

const router = Router();

// Health check
router.get(['/', '/health'], (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NexxSkill REST API (Node.js) is running',
    version: '1.0.4 - IPv4 Gmail SMTP & Diagnostic'
  });
});

router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/', leadRoutes);
router.use('/student', studentRoutes);
router.use('/coupons', couponRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);

export default router;
