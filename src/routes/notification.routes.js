import express from 'express';
import NotificationController from '../controllers/notification.controller.js';

const router = express.Router();

router.post('/send-notification', NotificationController.sendNotificationToUsers);
router.get('/notifications', NotificationController.listNotifications);
router.get('/notifications/:id', NotificationController.getNotificationById);

export default router;
