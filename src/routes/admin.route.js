import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import authorize from '../middleware/authorizeMiddleware.js';
import cacheMiddleware from '../middleware/cacheMiddleware.js';
import logActivity from '../middleware/logActivityMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', AdminController.login);
router.post('/request-otp', AdminController.requestOTP);
router.post('/verify-otp', AdminController.verifyOTP);
router.post('/change-password', AdminController.changePassword);

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Apply activity logging after authentication
router.use(logActivity);

// Super-admin only routes
router.post('/add-admin', authorize(['super-admin']), AdminController.addAdmin);
router.get('/all-admins', authorize(['super-admin']), AdminController.getAllAdmins);
router.get('/admin/:adminId', authorize(['super-admin']), AdminController.getAdmin);
router.put('/update-admin/:adminId', authorize(['super-admin']), AdminController.updateAdmin);
router.delete('/delete-admin/:adminId', authorize(['super-admin']), AdminController.deleteAdmin);
router.get('/permissions', authorize(['super-admin']), AdminController.getPermissions);
router.post('/permissions/:role', authorize(['super-admin']), AdminController.addOrUpdatePermissions);

// Routes accessible by both admin and super-admin
// Protected routes with caching
router.get('/all-users', AdminController.getAllUsers);
router.get('/users/form/:formId',  cacheMiddleware('usersofform', 300), AdminController.getAllUsersOfForm);
router.get('/user/:userId', cacheMiddleware('user', 300), AdminController.getUser);
router.get('/formsteps', cacheMiddleware('formsteps', 3600), AdminController.getFormSteps);
router.get('/lists', cacheMiddleware('lists', 300), AdminController.getLists);
router.get('/list/:listId', cacheMiddleware('list', 300), AdminController.getList);
router.get('/search-colleges', cacheMiddleware('colleges', 3600), AdminController.searchColleges);
router.get('/user/:userId/lists', cacheMiddleware('userlists', 300), AdminController.getUserLists);

// Non-cached routes
router.post('/user/search', AdminController.searchUser);
router.post('/user/add', AdminController.addUser);
router.put('/update-user/:userId', AdminController.updateUser);
router.delete('/delete-user/:userId', AdminController.deleteUser);

// Form steps routes
router.post('/edit-formsteps', authorize(['admin', 'super-admin']), AdminController.editFormSteps);

// List routes
router.post('/edit-lists', authorize(['admin', 'super-admin']), AdminController.editLists);
router.post('/delete-lists', authorize(['admin', 'super-admin']), AdminController.deleteLists);
router.post('/edit-list/:listId', authorize(['admin', 'super-admin']), AdminController.editList);
router.delete('/delete-list/:listId', authorize(['admin', 'super-admin']), AdminController.deleteList);
router.post('/add-list', authorize(['admin', 'super-admin']), AdminController.addList);

// User-specific list routes
router.post('/user/:userId/assign-list', AdminController.assignListToUser);
router.put('/user/:userId/list/:listId', AdminController.updateUserList);
router.delete('/user/:userId/list/:listId', AdminController.deleteUserList);

// Form config routes with caching
router.get('/form-config', cacheMiddleware('formconfig', 3600), AdminController.getFormConfig);
router.post('/form-config', AdminController.saveFormConfig);

//Cutoff specific routes
router.post('/getcutoff',  cacheMiddleware('cutoffs', 300), AdminController.getCutoff);
router.post('/add-note/:userId', AdminController.addNote);
router.get('/get-notes/:userId', cacheMiddleware('notes',300), AdminController.getNotes);


router.get('/activity/:adminId', AdminController.getActivityLogs);

// Remove unused routes
// router.post('/user/:userId/lists', AdminController.createUserList);
// router.delete('/user/:userId/lists/:listId', AdminController.deleteUserList);

export default router;
