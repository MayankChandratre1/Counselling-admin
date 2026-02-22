import express from 'express';
import NotificationController from '../controllers/notification.controller.js';

const router = express.Router();

router.post('/send-notification', NotificationController.sendNotificationToUsers);

export default router;
