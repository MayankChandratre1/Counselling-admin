import NotificationService from '../services/notification.service.js';

const NotificationController = {
    async sendNotificationToUsers(req, res) {
        try {
            const { userIds, title, message, url, toAll, filters, plan } = req.body;
            const result = await NotificationService.sendNotificationToUsers({
                userIds,
                title,
                message,
                url: url?.trim() || null,
                toAll,
                filters,
                plan: plan?.trim() || null,
                sentBy: req.admin?.id || null,
            });

            if (!result) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send push notification',
                });
            }

            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async listNotifications(req, res) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const result = await NotificationService.listNotifications({ page, limit });
            res.status(200).json({ success: true, ...result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async getNotificationById(req, res) {
        try {
            const notification = await NotificationService.getNotificationById(req.params.id);
            if (!notification) {
                return res.status(404).json({ success: false, error: 'Notification not found' });
            }
            res.status(200).json({ success: true, notification });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

export default NotificationController;
