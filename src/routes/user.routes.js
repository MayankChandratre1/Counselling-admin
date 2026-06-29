import express from 'express';
import UserController from '../controllers/user.controller.js';
import cacheMiddleware from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Protected routes should have auth middleware applied in the main index.js or here
router.get('/all-users', UserController.getAllUsers);
router.get('/all-users/export', UserController.exportUsers);
router.post('/users/form/:formId', UserController.getAllUsersOfForm);
router.get('/user/:userId', cacheMiddleware('user', 60), UserController.getUser);
router.post('/user/search', UserController.searchUser);
router.post('/user/add', UserController.addUser);
router.put('/update-user/:userId', UserController.updateUser);
router.delete('/delete-user/:userId', UserController.deleteUser);

export default router;
