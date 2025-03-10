import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', AdminController.login);

// Protected routes
router.use(authMiddleware); // Apply middleware to all routes below

router.get('/all-users', AdminController.getAllUsers);
router.get('/user/:userId', AdminController.getUser);
router.post('/user/search', AdminController.searchUser);
router.put('/update-user/:userId', AdminController.updateUser);
router.delete('/delete-user/:userId', AdminController.deleteUser);

router.get('/formsteps', AdminController.getFormSteps);
router.post('/edit-formsteps', AdminController.editFormSteps);

router.get('/lists', AdminController.getLists);
router.post('/edit-lists', AdminController.editLists);
router.post('/delete-lists', AdminController.deleteLists);

router.get('/list/:listId', AdminController.getList);
router.post('/edit-list/:listId', AdminController.editList);
router.delete('/delete-list/:listId', AdminController.deleteList);

export default router;
