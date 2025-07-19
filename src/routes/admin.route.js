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
router.get('/get-analytics',AdminController.getAnalytics);
router.get('/get-appointments', AdminController.getAppointments);
router.put('/edit-appointment/:id', AdminController.editAppointment);
router.get('/gettracking', AdminController.getTracking);
router.get('/user/:userId', cacheMiddleware('user', 300), AdminController.getUser);
router.post('/send-notification', AdminController.sendNotificationToUsers);
router.get('/dummy', AdminController.dummyController);
router.get('/get-premium-plans', cacheMiddleware('premiumplans', 300), AdminController.getPremiumPlans);

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
router.get('/all-users',cacheMiddleware("all-users", 300), AdminController.getAllUsers);
router.post('/users/form/:formId', AdminController.getAllUsersOfForm);
router.get('/user/:userId', cacheMiddleware('user', 300), AdminController.getUser);
router.get('/user/phone/:phone',  AdminController.getUserByPhone);
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
router.post('/append-list/:listId', authorize(['admin', 'super-admin']), AdminController.appendList);
router.delete('/delete-list/:listId', authorize(['admin', 'super-admin']), AdminController.deleteList);
router.post('/add-list', authorize(['admin', 'super-admin']), AdminController.addList);
// ...existing code...

// List restoration and copying routes
router.post('/list/restore-list/:listId', authorize(['admin', 'super-admin']), AdminController.restoreList);
router.post('/list/:listId/copy-to-folder/:folderId', authorize(['admin', 'super-admin']), AdminController.copyListToFolder);
router.post('/list/:listId/move-to-folder/:folderId', authorize(['admin', 'super-admin']), AdminController.moveListToFolder);

// ...existing code...

// User-specific list routes
router.post('/user/:userId/assign-list', AdminController.assignListToUser);
router.post('/user/:userId/release-list', AdminController.releaseListToUser);
router.post('/user/:userId/release-all-lists', AdminController.releaseAllListToUser);
router.post('/user/bulk-release-lists', AdminController.releaseAllListBulk);

router.put('/user/:userId/list/:listId', AdminController.updateUserList);
router.put('/user/:userId/created-list/:listId', AdminController.updateCreatedUserList);
router.delete('/user/:userId/list/:listId', AdminController.deleteUserList);
router.delete('/user/:userId/created-list/:listId', AdminController.deleteUserCreatedList);

// Form config routes with caching
router.get('/form-config', cacheMiddleware('formconfig', 3600), AdminController.getFormConfig);
router.post('/form-config', AdminController.saveFormConfig);

//Cutoff specific routes
router.post('/getcutoff',   AdminController.getCutoff);
router.post('/add-note/:userId', AdminController.addNote);
router.get('/get-notes/:userId', cacheMiddleware('notes',300), AdminController.getNotes);


router.get('/activity/:adminId', AdminController.getActivityLogs);

router.put('/update-user-step-data/:userId', AdminController.updateUserStepData);


router.put('/edit-landing-page', authorize(['admin', 'super-admin']), AdminController.editLandingPage);
router.get('/get-landing-page',  AdminController.getLandingPage);


router.get('/payments',  AdminController.getPayments);
// router.get('/payments',cacheMiddleware('payments', 300),  AdminController.getPayments);
router.get('/payments/order-id/:id', cacheMiddleware('payments_by_orderid', 300), AdminController.getPaymentsByOrderId);
router.get('/payments/payment-id/:id', cacheMiddleware('payments_by_paymentid', 300), AdminController.getPaymentsByPaymentId);
router.get('/payments/phone/:phone', AdminController.getUserPayment);

router.post('/update-home-page', authorize(['admin', 'super-admin']), AdminController.updateHomePage);
router.get('/get-home-page', cacheMiddleware('homepage', 300), AdminController.getHomePage);

router.post('/update-premium-plans', authorize(['admin', 'super-admin']), AdminController.updatePremiumPlans);


router.post('/update-contact-data', authorize(['admin', 'super-admin']), AdminController.updateContactData);
router.get('/get-contact-data', cacheMiddleware('contact', 300), AdminController.getContactData);

router.post('/update-dynamic-pages', authorize(['admin', 'super-admin']), AdminController.updateDynamicPages);
router.get('/get-dynamic-pages', cacheMiddleware('dynamic', 300), AdminController.getDynamicPages);

router.get('/getAll', authorize(['admin', 'super-admin']), AdminController.getAll);
router.get('/list-folders', cacheMiddleware('list_folders', 300), AdminController.getListFolders);
router.get('/list-folder/:folderId', cacheMiddleware('list_folder', 300), AdminController.getListFolder);
router.post('/list-folder', authorize(['admin', 'super-admin']), AdminController.createListFolder);
router.put('/list-folder/:folderId', authorize(['admin', 'super-admin']), AdminController.updateListFolder);
router.delete('/list-folder/:folderId', authorize(['admin', 'super-admin']), AdminController.deleteListFolder);
router.put('/list-folder/:folderId/archive', authorize(['admin', 'super-admin']), AdminController.archiveListFolder);



// Remove unused routes
// router.post('/user/:userId/lists', AdminController.createUserList);
// router.delete('/user/:userId/lists/:listId', AdminController.deleteUserList);

export default router;
