import mongoose from 'mongoose';
import { DeviceApprovalSchema } from '../../scripts/SchemasV3.js';

export const DeviceApproval = mongoose.models.DeviceApproval || mongoose.model('DeviceApproval', DeviceApprovalSchema, 'device_approvals');
export default DeviceApproval;