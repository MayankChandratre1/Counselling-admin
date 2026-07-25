import express from 'express';
import AnalyticsController from '../controllers/analytics.controller.js';
// import authMiddleware from '../middleware/authMiddleware.js'; // Ensure this is used in main index

const router = express.Router();

router.get('/get-analytics', AnalyticsController.getAnalytics);
router.get('/get-analytics-details', AnalyticsController.getEnrolledDetails);

export default router;
