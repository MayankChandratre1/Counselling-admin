/**
 * admin.mongo.service.js
 * 
 * MongoDB-based admin management service.
 * Replaces Firestore-based admin operations from admin.service.js
 * All admin, permissions, and admin_activities operations are now MongoDB-native.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Admin } from '../models/admin.model.js';
import { AdminActivity } from '../models/adminActivity.model.js';
import { DeviceApproval } from '../models/deviceApproval.model.js';
import { SecurityAuditLog } from '../models/securityAuditLog.model.js';
import { UserSessionLog } from '../models/userSessionLog.model.js';
import { User } from '../models/user.model.js';
import { Permission } from '../models/misc.model.js';
import cache from '../config/cache.js';
import { enrichLoginLocation } from '../utils/ipLocation.js';

class AdminMongoService {
    invalidateCache(pattern) {
        const cleanPattern = pattern.replace(/\*/g, '');
        const keys = cache.keys();
        const matches = keys.filter(k => k.includes(cleanPattern));
        if (matches.length > 0) {
            console.log(`Invalidating cache keys matching ${pattern}:`, matches.length);
            cache.del(matches);
        }
    }

    // ─── Admin Login ──────────────────────────────────────────────────────────

    resolveDeviceId(metadata = {}) {
        if (metadata.deviceId) return String(metadata.deviceId).trim();

        const ua = metadata.userAgent || 'unknown-ua';
        const ip = metadata.ip || 'unknown-ip';
        const fallback = crypto.createHash('sha256').update(`${ua}|${ip}`).digest('hex').slice(0, 32);
        return `admin_web_${fallback}`;
    }

    async logSessionAttempt({
        adminId,
        deviceId,
        ip,
        userAgent,
        status,
        approvalStatus,
        failureReason,
        sessionToken,
        city,
        region,
        country,
        reverseDns
    }) {
        try {
            await UserSessionLog.create({
                id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                userId: adminId,
                deviceId,
                ip: ip || '',
                city: city || '',
                region: region || '',
                country: country || '',
                reverseDns: reverseDns || '',
                userAgent: userAgent || '',
                loginTime: new Date(),
                status,
                failureReason: failureReason || '',
                approvalStatus,
                sessionToken: sessionToken || ''
            });
        } catch (error) {
            console.error('Failed to log admin session:', error.message);
        }
    }

    async login(credentials) {
        try {
            const admin = await Admin.findOne({ email: credentials.email }).lean();
            if (!admin) throw new Error('Admin not found');

            const isPasswordValid = await bcrypt.compare(credentials.password, admin.password);
            if (!isPasswordValid) throw new Error('Invalid password');

            const rawMeta = credentials.metadata || {};
            const loc = await enrichLoginLocation(rawMeta.ip);
            const metadata = {
                ...rawMeta,
                ip: loc.ip || rawMeta.ip || '',
                city: rawMeta.city || loc.city,
                region: rawMeta.region || loc.region,
                country: rawMeta.country || loc.country,
                reverseDns: rawMeta.reverseDns || loc.reverseDns
            };

            const adminId = admin.id || admin._id.toString();
            const deviceId = this.resolveDeviceId({
                deviceId: credentials.deviceId || metadata.deviceId,
                userAgent: metadata.userAgent,
                ip: metadata.ip
            });
            const isSecurityAdmin = admin.role === 'security-admin';

            if (!isSecurityAdmin) {
                let approval = await DeviceApproval.findOne({ userId: adminId, deviceId });
                if (!approval) {
                    approval = await DeviceApproval.create({
                        id: `approval_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                        userId: adminId,
                        deviceId,
                        deviceName: metadata.deviceName || 'Admin Web',
                        ip: metadata.ip || '',
                        city: metadata.city || '',
                        region: metadata.region || '',
                        country: metadata.country || '',
                        reverseDns: metadata.reverseDns || '',
                        status: 'pending',
                        requestedAt: new Date(),
                        lastCheckedAt: new Date(),
                        lastSeenAt: new Date(),
                        deviceInfo: {
                            userAgent: metadata.userAgent || '',
                            source: 'admin-web'
                        }
                    });
                } else {
                    approval.lastCheckedAt = new Date();
                    approval.lastSeenAt = new Date();
                    approval.ip = metadata.ip || approval.ip;
                    approval.deviceName = metadata.deviceName || approval.deviceName || 'Admin Web';
                    if (metadata.city) approval.city = metadata.city;
                    if (metadata.region) approval.region = metadata.region;
                    if (metadata.country) approval.country = metadata.country;
                    if (metadata.reverseDns) approval.reverseDns = metadata.reverseDns;
                    if (approval.status === 'approved') {
                        approval.deviceInfo = {
                            ...(approval.deviceInfo || {}),
                            userAgent: metadata.userAgent || approval.deviceInfo?.userAgent || '',
                            source: 'admin-web'
                        };
                    }
                    await approval.save();
                }

                if (approval.status !== 'approved') {
                    const denialReason = approval.status === 'revoked'
                        ? 'Access from this device has been revoked by security-admin'
                        : approval.status === 'rejected'
                            ? 'Access from this device was rejected by security-admin'
                            : 'Device authorization pending security-admin approval';

                    await this.logSessionAttempt({
                        adminId,
                        deviceId,
                        ip: metadata.ip,
                        userAgent: metadata.userAgent,
                        status: 'failed',
                        approvalStatus: approval.status,
                        failureReason: denialReason,
                        city: metadata.city,
                        region: metadata.region,
                        country: metadata.country,
                        reverseDns: metadata.reverseDns
                    });

                    const pendingError = new Error(denialReason);
                    pendingError.code = 'DEVICE_NOT_APPROVED';
                    pendingError.status = 403;
                    pendingError.details = {
                        approvalStatus: approval.status,
                        approvalId: approval.id,
                        deviceId
                    };
                    throw pendingError;
                }
            }

            // Use individual admin permissions (pages and components from admin document)
            const pages = admin.pages || [];
            const components = admin.components || [];

            const token = jwt.sign(
                {
                    id: adminId,
                    email: admin.email,
                    role: admin.role,
                    isSecurityMod: Boolean(admin.isSecurityMod),
                    deviceId,
                    scope: 'full'
                },
                process.env.JWT_ADMIN_SECRET,
                { expiresIn: '7d' }
            );

            await this.logSessionAttempt({
                adminId,
                deviceId,
                ip: metadata.ip,
                userAgent: metadata.userAgent,
                status: 'success',
                approvalStatus: 'approved',
                sessionToken: token,
                city: metadata.city,
                region: metadata.region,
                country: metadata.country,
                reverseDns: metadata.reverseDns
            });

            return {
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                    isSecurityMod: Boolean(admin.isSecurityMod),
                    permissions: { pages, components }
                }
            };
        } catch (error) {
            throw error.code ? error : new Error('Login failed: ' + error.message);
        }
    }

    // ─── Admin CRUD ───────────────────────────────────────────────────────────

    async getAllAdmins() {
        try {
            const admins = await Admin.find().select('-password').lean();
            // Return with pages and components included
            return admins;
        } catch (error) {
            throw new Error('Failed to get admins: ' + error.message);
        }
    }

    async getAdmin(adminId) {
        try {
            // Try by id field first
            let admin = await Admin.findOne({ id: adminId }).select('-password').lean();
            
            // Fallback to MongoDB _id
            if (!admin && mongoose.Types.ObjectId.isValid(adminId)) {
                admin = await Admin.findById(adminId).select('-password').lean();
            }

            if (!admin) throw new Error('Admin not found');
            return admin;
        } catch (error) {
            throw new Error('Failed to get admin: ' + error.message);
        }
    }

    async addAdmin(adminData) {
        try {
            const normalizedEmail = (adminData.email || '').toString().trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
                throw new Error('Valid email is required');
            }

            // Check if admin with email already exists
            const existing = await Admin.findOne({ email: normalizedEmail });
            if (existing) throw new Error('Admin with this email already exists');

            if (!adminData.role) {
                adminData.role = 'admin'; // Default role
            }
            if (!adminData.password) {
                adminData.password = 'admin123'; // Default password
            }

            if (adminData.password && adminData.password.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(adminData.password, 12);

            const adminId = 'admin_' + Date.now();
            const newAdmin = new Admin({
                id: adminId,
                email: normalizedEmail,
                password: hashedPassword,
                name: adminData.name || '',
                role: adminData.role,
                isSecurityMod: Boolean(adminData.isSecurityMod),
                pages: adminData.pages || [],
                components: adminData.components || []
            });

            await newAdmin.save();

            return {
                message: 'Admin added successfully',
                admin: {
                    id: newAdmin.id,
                    email: newAdmin.email,
                    name: newAdmin.name,
                    role: newAdmin.role,
                    isSecurityMod: Boolean(newAdmin.isSecurityMod),
                    pages: newAdmin.pages,
                    components: newAdmin.components
                }
            };
        } catch (error) {
            throw new Error('Failed to add admin: ' + error.message);
        }
    }

    async updateAdmin(adminId, adminData) {
        try {
            // Find admin by id field or MongoDB _id
            let admin = await Admin.findOne({ id: adminId });
            if (!admin && mongoose.Types.ObjectId.isValid(adminId)) {
                admin = await Admin.findById(adminId);
            }
            if (!admin) throw new Error('Admin not found');

            const updatePayload = {};

            if (typeof adminData.email === 'string') {
                const normalizedEmail = adminData.email.trim().toLowerCase();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
                    throw new Error('Valid email is required');
                }

                const existingAdmin = await Admin.findOne({ email: normalizedEmail });
                const conflicting = existingAdmin && existingAdmin.id !== admin.id && existingAdmin._id.toString() !== admin._id.toString();
                if (conflicting) {
                    throw new Error('Admin with this email already exists');
                }
                updatePayload.email = normalizedEmail;
            }

            if (adminData.role === 'super-admin' && adminData.password) {
                throw new Error('Super-admin password cannot be changed');
            }

            // If password is being updated, hash it
            if (typeof adminData.password === 'string') {
                const trimmedPassword = adminData.password.trim();
                if (trimmedPassword) {
                    if (trimmedPassword.length < 6) {
                        throw new Error('Password must be at least 6 characters long');
                    }
                    updatePayload.password = await bcrypt.hash(trimmedPassword, 12);
                }
            }

            if (adminData.name !== undefined) {
                updatePayload.name = adminData.name;
            }
            if (adminData.role !== undefined) {
                updatePayload.role = adminData.role;
            }
            if (adminData.isSecurityMod !== undefined) {
                updatePayload.isSecurityMod = Boolean(adminData.isSecurityMod);
            }
            if (adminData.pages !== undefined) {
                updatePayload.pages = adminData.pages;
            }
            if (adminData.components !== undefined) {
                updatePayload.components = adminData.components;
            }

            const updateFilter = admin.id ? { id: admin.id } : { _id: admin._id };
            const updated = await Admin.findOneAndUpdate(
                updateFilter,
                { $set: updatePayload },
                { new: true }
            ).select('-password');

            return {
                message: 'Admin updated successfully',
                admin: updated
            };
        } catch (error) {
            throw new Error('Failed to update admin: ' + error.message);
        }
    }

    async deleteAdmin(adminId) {
        try {
            let admin = await Admin.findOne({ id: adminId });
            if (!admin && mongoose.Types.ObjectId.isValid(adminId)) {
                admin = await Admin.findById(adminId);
            }
            if (!admin) throw new Error('Admin not found');

            // Prevent deleting super-admin
            if (admin.role === 'super-admin') {
                throw new Error('Cannot delete super-admin');
            }

            const deleteFilter = admin.id ? { id: admin.id } : { _id: admin._id };
            await Admin.deleteOne(deleteFilter);

            return { message: 'Admin deleted successfully' };
        } catch (error) {
            throw new Error('Failed to delete admin: ' + error.message);
        }
    }

    // ─── Permissions ──────────────────────────────────────────────────────────

    async getPermissions() {
        try {
            const permissions = await Permission.find().lean();
            const normalized = permissions.map(p => ({
                role: p.id,
                pages: p.pages || [],
                components: p.components || []
            }));

            const defaultRoles = ['admin', 'super-admin', 'editor', 'security-admin'];
            for (const role of defaultRoles) {
                if (!normalized.some(item => item.role === role)) {
                    normalized.push({ role, pages: [], components: [] });
                }
            }

            return normalized;
        } catch (error) {
            throw new Error('Failed to get permissions: ' + error.message);
        }
    }

    async addOrUpdatePermissions(role, permissionsData) {
        try {
            const updateData = {};
            if (permissionsData.pages !== undefined) {
                updateData.pages = permissionsData.pages;
            }
            if (permissionsData.components !== undefined) {
                updateData.components = permissionsData.components;
            }

            const updated = await Permission.findOneAndUpdate(
                { id: role },
                { $set: updateData },
                { upsert: true, new: true }
            );

            return {
                message: 'Permissions updated successfully',
                role: updated.id,
                permissions: updated
            };
        } catch (error) {
            throw new Error('Failed to update permissions: ' + error.message);
        }
    }

    // ─── Activity Logs ────────────────────────────────────────────────────────

    async getActivityLogs(adminId) {
        try {
            // Find activities by adminId, exclude GET requests, sort by timestamp desc, limit to 1000
            const activities = await AdminActivity.find({
                adminId,
                method: { $ne: 'GET' }
            })
                .sort({ timestamp: -1 })
                .limit(1000)
                .lean();

            return {
                activities,
                message: `Fetching activity logs for admin ID: ${adminId}`
            };
        } catch (error) {
            throw new Error('Failed to get activity logs: ' + error.message);
        }
    }

    async getDeviceApprovals(filters = {}) {
        try {
            const query = {};
            if (filters.userId) query.userId = filters.userId;
            if (filters.deviceId) query.deviceId = filters.deviceId;
            if (filters.status) query.status = filters.status;

            const limit = Math.min(Number(filters.limit) || 100, 500);

            const approvals = await DeviceApproval.find(query)
                .sort({ updatedAt: -1, requestedAt: -1 })
                .limit(limit)
                .lean();

            const userIds = [...new Set(approvals.map(item => item.userId).filter(Boolean))];
            const objectIdUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            const users = userIds.length
                ? await User.find({
                    $or: [
                        { id: { $in: userIds } },
                        ...(objectIdUserIds.length ? [{ _id: { $in: objectIdUserIds.map(id => new mongoose.Types.ObjectId(id)) } }] : [])
                    ]
                }).select('id name email phone counsellingData').lean()
                : [];
            const admins = userIds.length
                ? await Admin.find({
                    $or: [
                        { id: { $in: userIds } },
                        ...(objectIdUserIds.length ? [{ _id: { $in: objectIdUserIds.map(id => new mongoose.Types.ObjectId(id)) } }] : [])
                    ]
                }).select('id name email').lean()
                : [];

            const userMap = new Map(
                users.map(user => {
                    const displayName = user.name || user.counsellingData?.fullName || user.phone || user.id;
                    const email = user.email || user.counsellingData?.email || '';
                    const key = user.id || user._id?.toString();
                    return [key, { displayName, email }];
                }).filter(([key]) => Boolean(key))
            );

            const adminMap = new Map(
                admins.map(admin => {
                    const displayName = admin.name || admin.email || admin.id;
                    const key = admin.id || admin._id?.toString();
                    return [key, { displayName, email: admin.email || '' }];
                }).filter(([key]) => Boolean(key))
            );

            const enrichedApprovals = approvals.map(item => {
                const identity = userMap.get(item.userId) || adminMap.get(item.userId) || {};
                return {
                    ...item,
                    userName: identity.displayName || item.userId,
                    userEmail: identity.email || ''
                };
            });

            return { approvals: enrichedApprovals };
        } catch (error) {
            throw new Error('Failed to get device approvals: ' + error.message);
        }
    }

    async approveDevice(approvalId, admin, payload = {}) {
        try {
            const approval = await DeviceApproval.findOne({ id: approvalId });
            if (!approval) {
                throw new Error('Device approval request not found');
            }

            approval.status = 'approved';
            approval.approvedAt = new Date();
            approval.approvedBy = admin?.id || null;
            approval.approvedByEmail = admin?.email || null;
            approval.approvalReason = payload.reason || approval.approvalReason || '';
            approval.lastCheckedAt = new Date();
            await approval.save();

            await SecurityAuditLog.create({
                id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                userId: approval.userId,
                deviceId: approval.deviceId,
                adminId: admin?.id || null,
                adminEmail: admin?.email || null,
                action: 'approval',
                status: 'success',
                reason: approval.approvalReason || 'Approved by security-admin',
                ip: approval.ip,
                city: approval.city,
                region: approval.region,
                timestamp: new Date()
            });

            return approval.toObject();
        } catch (error) {
            throw new Error('Failed to approve device: ' + error.message);
        }
    }

    async revokeDevice(approvalId, admin, payload = {}) {
        try {
            const approval = await DeviceApproval.findOne({ id: approvalId });
            if (!approval) {
                throw new Error('Device approval request not found');
            }

            approval.status = 'revoked';
            approval.revokedAt = new Date();
            approval.revokedBy = admin?.id || null;
            approval.revokedByEmail = admin?.email || null;
            approval.approvalReason = payload.reason || approval.approvalReason || '';
            approval.lastCheckedAt = new Date();
            await approval.save();

            await SecurityAuditLog.create({
                id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                userId: approval.userId,
                deviceId: approval.deviceId,
                adminId: admin?.id || null,
                adminEmail: admin?.email || null,
                action: 'revocation',
                status: 'success',
                reason: approval.approvalReason || 'Access revoked by security-admin',
                ip: approval.ip,
                city: approval.city,
                region: approval.region,
                timestamp: new Date()
            });

            return approval.toObject();
        } catch (error) {
            throw new Error('Failed to revoke device access: ' + error.message);
        }
    }

    async rejectDevice(approvalId, admin, payload = {}) {
        try {
            const approval = await DeviceApproval.findOne({ id: approvalId });
            if (!approval) {
                throw new Error('Device approval request not found');
            }

            approval.status = 'rejected';
            approval.rejectedAt = new Date();
            approval.approvalReason = payload.reason || approval.approvalReason || '';
            approval.lastCheckedAt = new Date();
            await approval.save();

            await SecurityAuditLog.create({
                id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                userId: approval.userId,
                deviceId: approval.deviceId,
                adminId: admin?.id || null,
                adminEmail: admin?.email || null,
                action: 'rejection',
                status: 'success',
                reason: approval.approvalReason || 'Rejected by security-admin',
                ip: approval.ip,
                city: approval.city,
                region: approval.region,
                timestamp: new Date()
            });

            return approval.toObject();
        } catch (error) {
            throw new Error('Failed to reject device: ' + error.message);
        }
    }

    async getUserSessions(filters = {}) {
        try {
            const query = {};
            if (filters.userId) query.userId = filters.userId;
            if (filters.deviceId) query.deviceId = filters.deviceId;
            if (filters.status) query.status = filters.status;

            const limit = Math.min(Number(filters.limit) || 100, 500);

            const sessions = await UserSessionLog.find(query)
                .sort({ loginTime: -1, updatedAt: -1 })
                .limit(limit)
                .lean();

            const userIds = [...new Set(sessions.map(item => item.userId).filter(Boolean))];
            const objectIdUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            const users = userIds.length
                ? await User.find({
                    $or: [
                        { id: { $in: userIds } },
                        ...(objectIdUserIds.length ? [{ _id: { $in: objectIdUserIds.map(id => new mongoose.Types.ObjectId(id)) } }] : [])
                    ]
                }).select('id name email phone counsellingData').lean()
                : [];
            const admins = userIds.length
                ? await Admin.find({
                    $or: [
                        { id: { $in: userIds } },
                        ...(objectIdUserIds.length ? [{ _id: { $in: objectIdUserIds.map(id => new mongoose.Types.ObjectId(id)) } }] : [])
                    ]
                }).select('id name email').lean()
                : [];

            const userMap = new Map(
                users.map(user => {
                    const displayName = user.name || user.counsellingData?.fullName || user.phone || user.id;
                    const email = user.email || user.counsellingData?.email || '';
                    const key = user.id || user._id?.toString();
                    return [key, { displayName, email }];
                }).filter(([key]) => Boolean(key))
            );

            const adminMap = new Map(
                admins.map(admin => {
                    const displayName = admin.name || admin.email || admin.id;
                    const key = admin.id || admin._id?.toString();
                    return [key, { displayName, email: admin.email || '' }];
                }).filter(([key]) => Boolean(key))
            );

            const enrichedSessions = sessions.map(item => {
                const identity = userMap.get(item.userId) || adminMap.get(item.userId) || {};
                return {
                    ...item,
                    userName: identity.displayName || item.userId,
                    userEmail: identity.email || ''
                };
            });

            return { sessions: enrichedSessions };
        } catch (error) {
            throw new Error('Failed to get user sessions: ' + error.message);
        }
    }

    /**
     * Log an admin activity (called by middleware or manually)
     */
    async logActivity(activityData) {
        try {
            const activityId = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            const activity = new AdminActivity({
                id: activityId,
                adminId: activityData.adminId,
                adminEmail: activityData.adminEmail,
                method: activityData.method,
                path: activityData.path,
                timestamp: activityData.timestamp || new Date(),
            });

            await activity.save();
            return activity;
        } catch (error) {
            console.error('Failed to log activity:', error.message);
            // Don't throw - logging failure shouldn't break the actual operation
        }
    }

    async logSecurityAudit(auditData) {
        try {
            const audit = new SecurityAuditLog({
                id: auditData.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                userId: auditData.userId,
                deviceId: auditData.deviceId,
                adminId: auditData.adminId,
                adminEmail: auditData.adminEmail,
                action: auditData.action,
                status: auditData.status || 'success',
                reason: auditData.reason,
                ip: auditData.ip,
                city: auditData.city,
                region: auditData.region,
                timestamp: auditData.timestamp || new Date()
            });

            await audit.save();
            return audit;
        } catch (error) {
            console.error('Failed to log security audit:', error.message);
        }
    }
}

export default new AdminMongoService();
