import AuthService from '../services/auth.service.js';

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await AuthService.login(email, password);
            res.status(200).json(result);
        } catch (error) {
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
