import { Router } from 'express';
import * as courseController from '../controllers/courseController.js';

const router = Router();

router.get('/', courseController.getPublicCourses);
router.get('/:slug', courseController.getCourseBySlug);

export default router;
