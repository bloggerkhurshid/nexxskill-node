import { Router } from 'express';
import * as leadController from '../controllers/leadController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/leads', leadController.createLead);
router.post('/contact', leadController.submitContact);
router.get('/webinars', leadController.getPublicWebinars);
router.post('/webinars/register', leadController.registerWebinar);
router.delete('/webinars/:id/booking', requireAuth, leadController.cancelWebinarBooking);
router.get('/faqs', leadController.getPublicFaqs);
router.all('/webinars/trigger-reminders', leadController.triggerWebinarReminders);

export default router;
