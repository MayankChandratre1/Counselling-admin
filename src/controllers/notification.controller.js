import NotificationService from '../services/notification.service.js';

const NotificationController = {
    async sendNotificationToUsers(req, res) {
        try {
            const { userIds, title, message, toAll, filters } = req.body;
            const result = await NotificationService.sendNotificationToUsers(userIds, title, message, toAll, filters);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

export default NotificationController;
