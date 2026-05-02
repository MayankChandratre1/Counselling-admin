import mongoose from 'mongoose';
import { SecurityAuditLogSchema } from '../../scripts/SchemasV3.js';

export const SecurityAuditLog = mongoose.models.SecurityAuditLog || mongoose.model('SecurityAuditLog', SecurityAuditLogSchema, 'security_audit_logs');
export default SecurityAuditLog;