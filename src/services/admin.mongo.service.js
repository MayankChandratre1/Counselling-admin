/**
 * admin.mongo.service.js
 * 
 * MongoDB-based admin management service.
 * Replaces Firestore-based admin operations from admin.service.js
 * All admin, permissions, and admin_activities operations are now MongoDB-native.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Admin } from '../models/admin.model.js';
import { AdminActivity } from '../models/adminActivity.model.js';
import { Permission } from '../models/misc.model.js';
import cache from '../config/cache.js';

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

    async login(credentials) {
        try {
            const admin = await Admin.findOne({ email: credentials.email }).lean();
            if (!admin) throw new Error('Admin not found');

            const isPasswordValid = await bcrypt.compare(credentials.password, admin.password);
            if (!isPasswordValid) throw new Error('Invalid password');

            // Use individual admin permissions (pages and components from admin document)
            const pages = admin.pages || [];
            const components = admin.components || [];

            const token = jwt.sign(
                { id: admin.id, email: admin.email, role: admin.role },
                process.env.JWT_ADMIN_SECRET,
                { expiresIn: '7d' }
            );

            return {
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                    permissions: { pages, components }
                }
            };
        } catch (error) {
            throw new Error('Login failed: ' + error.message);
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
            return permissions.map(p => ({
                role: p.id,
                pages: p.pages || [],
                components: p.components || []
            }));
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
                params: activityData.params,
                query: activityData.query,
                body: activityData.body,
                status: activityData.status,
                response: activityData.response,
                timestamp: activityData.timestamp || new Date(),
                ip: activityData.ip,
                userAgent: activityData.userAgent
            });

            await activity.save();
            return activity;
        } catch (error) {
            console.error('Failed to log activity:', error.message);
            // Don't throw - logging failure shouldn't break the actual operation
        }
    }
}

export default new AdminMongoService();
