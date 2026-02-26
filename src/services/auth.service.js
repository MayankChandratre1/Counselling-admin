import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/admin.model.js';

class AuthService {
    /**
     * Login with email + password.
     * Returns a signed JWT + the admin's permission pages.
     */
    async login(email, password) {
        const admin = await Admin.findOne({ email });
        if (!admin) throw new Error('Admin not found');

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) throw new Error('Invalid credentials');

        // Use individual admin permissions (pages and components from admin document)
        const pages = admin.pages || [];
        const components = admin.components || [];

        const token = jwt.sign(
            { id: admin._id, email: admin.email, role: admin.role },
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
