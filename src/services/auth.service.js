import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Admin } from '../models/admin.model.js';
import { DeviceApproval } from '../models/deviceApproval.model.js';
import { UserSessionLog } from '../models/userSessionLog.model.js';
import { enrichLoginLocation } from '../utils/ipLocation.js';

class AuthService {
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
            // Logging should not block auth decisions.
            console.error('Failed to log admin session:', error.message);
        }
    }

    /**
     * Login with email + password.
     * Returns a signed JWT + the admin's permission pages.
     */
    async login(email, password, metadata = {}) {
        const admin = await Admin.findOne({ email });
        if (!admin) throw new Error('Admin not found');

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) throw new Error('Invalid credentials');

        const loc = await enrichLoginLocation(metadata.ip);
        const meta = {
            ...metadata,
            ip: loc.ip || metadata.ip || '',
            city: metadata.city || loc.city,
            region: metadata.region || loc.region,
            country: metadata.country || loc.country,
            reverseDns: metadata.reverseDns || loc.reverseDns
        };

        const adminId = admin.id || admin._id.toString();
        const deviceId = this.resolveDeviceId(meta);
        const isSecurityAdmin = admin.role === 'security-admin';

        if (!isSecurityAdmin) {
            let approval = await DeviceApproval.findOne({ userId: adminId, deviceId });
            if (!approval) {
                approval = await DeviceApproval.create({
                    id: `approval_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                    userId: adminId,
                    deviceId,
                    deviceName: meta.deviceName || 'Admin Web',
                    ip: meta.ip || '',
                    city: meta.city || '',
                    region: meta.region || '',
                    country: meta.country || '',
                    reverseDns: meta.reverseDns || '',
                    status: 'pending',
                    requestedAt: new Date(),
                    lastCheckedAt: new Date(),
                    lastSeenAt: new Date(),
                    deviceInfo: {
                        userAgent: meta.userAgent || '',
                        source: 'admin-web'
                    }
                });
            } else {
                approval.lastCheckedAt = new Date();
                approval.lastSeenAt = new Date();
                approval.ip = meta.ip || approval.ip;
                approval.deviceName = meta.deviceName || approval.deviceName || 'Admin Web';
                if (meta.city) approval.city = meta.city;
                if (meta.region) approval.region = meta.region;
                if (meta.country) approval.country = meta.country;
                if (meta.reverseDns) approval.reverseDns = meta.reverseDns;
                if (approval.status === 'approved') {
                    approval.deviceInfo = {
                        ...(approval.deviceInfo || {}),
                        userAgent: meta.userAgent || approval.deviceInfo?.userAgent || '',
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
                    ip: meta.ip,
                    userAgent: meta.userAgent,
                    status: 'failed',
                    approvalStatus: approval.status,
                    failureReason: denialReason,
                    city: meta.city,
                    region: meta.region,
                    country: meta.country,
                    reverseDns: meta.reverseDns
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
            ip: meta.ip,
            userAgent: meta.userAgent,
            status: 'success',
            approvalStatus: 'approved',
            sessionToken: token,
            city: meta.city,
            region: meta.region,
            country: meta.country,
            reverseDns: meta.reverseDns
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
    }

    /**
     * Request OTP — generates a 6-digit OTP, stores it on the Admin doc
     * with a 10-minute expiry, and returns it (caller logs / sends email).
     */
    async requestOTP(email) {
        const admin = await Admin.findOne({ email });
        if (!admin) throw new Error('Admin not found');

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        await Admin.findOneAndUpdate(
            { email },
            { $set: { otp, otpExpiry: expiry } }
        );

        return { otp, message: 'OTP generated successfully' };
    }

    /**
     * Verify OTP sent to admin email.
     */
    async verifyOTP(email, otp) {
        const admin = await Admin.findOne({ email });
        if (!admin) throw new Error('Admin not found');

        if (admin.otp !== otp) throw new Error('Invalid OTP');
        if (!admin.otpExpiry || new Date() > new Date(admin.otpExpiry)) {
            throw new Error('OTP expired');
        }

        // Clear OTP after successful verification
        await Admin.findOneAndUpdate(
            { email },
            { $unset: { otp: 1, otpExpiry: 1 } }
        );

        return { message: 'OTP verified successfully' };
    }

    /**
     * Change password — requires old password verification.
     */
    async changePassword(email, oldPassword, newPassword) {
        const admin = await Admin.findOne({ email });
        if (!admin) throw new Error('Admin not found');

        const isMatch = await bcrypt.compare(oldPassword, admin.password);
        if (!isMatch) throw new Error('Incorrect current password');

        const hashed = await bcrypt.hash(newPassword, 10);
        await Admin.findOneAndUpdate({ email }, { $set: { password: hashed } });

        return { message: 'Password changed successfully' };
    }

    /**
     * Reset password with OTP (no old password needed, OTP must have been verified first).
     */
    async resetPassword(email, newPassword) {
        const admin = await Admin.findOne({ email });
        if (!admin) throw new Error('Admin not found');

        const hashed = await bcrypt.hash(newPassword, 10);
        await Admin.findOneAndUpdate({ email }, { $set: { password: hashed } });

        return { message: 'Password reset successfully' };
    }
}

export default new AuthService();
