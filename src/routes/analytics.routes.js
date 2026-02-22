import express from 'express';
import AnalyticsController from '../controllers/analytics.controller.js';
// import authMiddleware from '../middleware/authMiddleware.js'; // Ensure this is used in main index

const router = express.Router();

router.get('/get-analytics', AnalyticsController.getAnalytics);

export default router;
