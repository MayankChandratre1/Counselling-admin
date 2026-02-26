import mongoose from 'mongoose';
import { AdminActivitySchema } from '../../scripts/SchemasV3.js';

export const AdminActivity = mongoose.models.AdminActivity || mongoose.model('AdminActivity', AdminActivitySchema, 'admin_activities');
export default AdminActivity;
