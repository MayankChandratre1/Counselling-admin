import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', AdminController.login);
router.post('/request-otp', AdminController.requestOTP);
router.post('/verify-otp', AdminController.verifyOTP);
router.post('/change-password', AdminController.changePassword);

// Apply middleware to all routes below this line
router.use(authMiddleware);

// Protected routes
// User routes
router.get('/all-users', AdminController.getAllUsers);
router.get('/user/:userId', AdminController.getUser);
router.post('/user/search', AdminController.searchUser);
router.put('/update-user/:userId', AdminController.updateUser);
router.delete('/delete-user/:userId', AdminController.deleteUser);

// Form steps routes
router.get('/formsteps', AdminController.getFormSteps);
router.post('/edit-formsteps', AdminController.editFormSteps);

// List routes
router.get('/lists', AdminController.getLists);
router.post('/edit-lists', AdminController.editLists);
router.post('/delete-lists', AdminController.deleteLists);
router.get('/list/:listId', AdminController.getList);
router.post('/edit-list/:listId', AdminController.editList);
router.delete('/delete-list/:listId', AdminController.deleteList);
router.post('/add-list', AdminController.addList);

// Search colleges route
router.get('/search-colleges', AdminController.searchColleges);

// User-specific list routes
router.get('/user/:userId/lists', AdminController.getUserLists);
router.post('/user/:userId/assign-list', AdminController.assignListToUser);
router.put('/user/:userId/list/:listId', AdminController.updateUserList);
router.delete('/user/:userId/list/:listId', AdminController.deleteUserList); // Add this line

// Remove unused routes
// router.post('/user/:userId/lists', AdminController.createUserList);
// router.delete('/user/:userId/lists/:listId', AdminController.deleteUserList);

export default router;
