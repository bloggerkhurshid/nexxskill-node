import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/send-otp', authController.sendRegisterOtp);
router.post('/send-register-otp', authController.sendRegisterOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.get('/test-mail', authController.testMail);
router.get('/me', requireAuth, authController.me);

export default router;
