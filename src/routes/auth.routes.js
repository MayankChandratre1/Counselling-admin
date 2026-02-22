import express from 'express';
import AuthController from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/login', AuthController.login);
router.post('/request-otp', AuthController.requestOTP);
router.post('/verify-otp', AuthController.verifyOTP);
router.post('/change-password', AuthController.changePassword);

export default router;
