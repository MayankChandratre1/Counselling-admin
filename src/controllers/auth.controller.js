import AuthService from '../services/auth.service.js';

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await AuthService.login(email, password, {
                deviceId: req.body?.deviceId || req.headers['x-device-id'] || req.headers['device-id'],
                deviceName: req.body?.deviceName || req.headers['x-device-name'] || 'Admin Web',
                ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
                userAgent: req.get('user-agent') || ''
            });
            res.status(200).json(result);
        } catch (error) {
            if (error.code === 'DEVICE_NOT_APPROVED') {
                return res.status(error.status || 403).json({
                    error: error.message,
                    code: error.code,
                    ...error.details
                });
            }
            res.status(401).json({ error: error.message });
        }
    }

    async requestOTP(req, res) {
        try {
            const { email } = req.body;
            const result = await AuthService.requestOTP(email);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async verifyOTP(req, res) {
        try {
            const { email, otp } = req.body;
            const result = await AuthService.verifyOTP(email, otp);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async changePassword(req, res) {
        try {
            const { email, otp, newPassword } = req.body;
            const result = await AuthService.changePassword(email, otp, newPassword);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

export default new AuthController();
