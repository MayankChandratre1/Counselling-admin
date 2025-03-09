import express from 'express';
import UserController from '../controllers/user.controller.js';

const router = express.Router();

// Add OTP route before login
router.post('/send-otp', UserController.sendOTP);
router.post('/login', UserController.login);
router.post('/logout', UserController.logout);

// User registration and retrieval
router.post('/', UserController.createUser);
router.get('/:id', UserController.getUserById);
router.get('/phone/:phone', UserController.getUserByPhone);

// Premium plan management
router.post('/ispremium', UserController.checkPremiumStatusByPhone);
router.patch('/:id/premium', UserController.updatePremiumPlan);
router.get('/:id/premium-status', UserController.checkPremiumStatus);

//add two routes 1. /formsteps 2. /formsteps/:id
router.get('/formsteps/userdata', UserController.getUserFormData);
router.get('/formsteps/:formName', UserController.getFormSteps);

export default router;
