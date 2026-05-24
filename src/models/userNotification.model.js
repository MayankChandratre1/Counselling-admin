import mongoose from 'mongoose';
import { UserNotificationSchema } from '../../scripts/SchemasV3.js';

export const UserNotification = mongoose.models.UserNotification
  || mongoose.model('UserNotification', UserNotificationSchema, 'usernotifications');

export default UserNotification;
