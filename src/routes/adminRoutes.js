import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as adminController from '../controllers/adminController.js';
import * as courseController from '../controllers/courseController.js';
import * as couponController from '../controllers/couponController.js';
import { requireAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads/videos');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const filename = `recording_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

const router = Router();

router.use(requireAdmin);

// Overview
router.get('/overview', adminController.getOverview);

// Courses
router.get('/courses', courseController.getAdminCourses);
router.post('/courses', courseController.createCourse);
router.put('/courses/:id', courseController.updateCourse);
router.delete('/courses/:id', courseController.deleteCourse);

// Enrollments
router.get('/enrollments', adminController.getEnrollments);
router.put('/enrollments/:id', adminController.updateEnrollmentStatus);
router.delete('/enrollments/:id', adminController.deleteEnrollment);

// Leads & Messages
router.get('/leads', adminController.getLeads);
router.put('/leads/:id', adminController.updateLeadStatus);
router.get('/messages', adminController.getMessages);
router.put('/messages/:id', adminController.updateMessageStatus);

// Students
router.get('/students', adminController.getStudents);

// Webinars
router.get('/webinars/registrations', adminController.getWebinarRegistrations);
router.post('/webinars', adminController.saveWebinar);
router.put('/webinars/:id', adminController.saveWebinar);
router.delete('/webinars/:id', adminController.deleteWebinar);

// FAQs
router.post('/faqs', adminController.saveFaq);
router.put('/faqs/:id', adminController.saveFaq);
router.delete('/faqs/:id', adminController.deleteFaq);

// Coupons
router.get('/coupons', couponController.getAdminCoupons);
router.post('/coupons', couponController.saveCoupon);
router.put('/coupons/:id', couponController.saveCoupon);
router.delete('/coupons/:id', couponController.deleteCoupon);

// File Upload
router.post('/upload', upload.single('video'), adminController.handleUploadResponse);

export default router;
