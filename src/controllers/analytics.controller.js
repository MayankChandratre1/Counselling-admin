import AnalyticsService from '../services/analytics.service.js';

const AnalyticsController = {
    async getAnalytics(req, res) {
        try {
            const data = await AnalyticsService.getAnalytics();
            res.status(200).json(data);
        } catch (error) {
            console.error('Analytics Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async getEnrolledDetails(req, res) {
        try {
            const data = await AnalyticsService.getEnrolledDetails();
            res.status(200).json(data);
        } catch (error) {
            console.error('Analytics details Error:', error);
            res.status(500).json({ error: error.message });
        }
    },
};

export default AnalyticsController;
