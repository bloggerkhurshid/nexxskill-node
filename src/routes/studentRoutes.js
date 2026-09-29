import { Router } from 'express';
import * as studentController from '../controllers/studentController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/enrollments', studentController.getEnrollments);
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.updateProfile);

export default router;
