import mongoose from 'mongoose';
import { UserSessionLogSchema } from '../../scripts/SchemasV3.js';

export const UserSessionLog = mongoose.models.UserSessionLog || mongoose.model('UserSessionLog', UserSessionLogSchema, 'user_session_logs');
export default UserSessionLog;