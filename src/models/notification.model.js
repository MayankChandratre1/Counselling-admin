import mongoose from 'mongoose';
import { NotificationSchema } from '../../scripts/SchemasV3.js';

export const Notification = mongoose.models.Notification
  || mongoose.model('Notification', NotificationSchema, 'notifications');

export default Notification;
