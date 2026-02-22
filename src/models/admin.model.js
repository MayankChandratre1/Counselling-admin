import mongoose from 'mongoose';
import { AdminSchema } from '../../scripts/SchemasV3.js';

export const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema, 'admins');
export default Admin;
