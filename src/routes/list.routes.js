import express from 'express';
import ListController from '../controllers/list.controller.js';
import authorize from '../middleware/authorizeMiddleware.js';

const router = express.Router();

// Master Lists
router.get('/lists', ListController.getLists);
router.get('/list/:listId', ListController.getList);
router.post('/add-list', authorize(['admin', 'super-admin']), ListController.addList);
router.post('/edit-list/:listId', authorize(['admin', 'super-admin']), ListController.editList);
router.delete('/delete-list/:listId', authorize(['admin', 'super-admin']), ListController.deleteList);
router.post('/list/:listId/copy-to-folder/:folderId', authorize(['admin', 'super-admin']), ListController.copyListToFolder);
router.post('/list/:listId/move-to-folder/:folderId', authorize(['admin', 'super-admin']), ListController.moveListToFolder);
router.put('/list-folder/:folderId', authorize(['admin', 'super-admin']), ListController.updateListFolder);
router.delete('/list-folder/:folderId', authorize(['admin', 'super-admin']), ListController.deleteListFolder);

// User Lists
router.get('/user/:userId/lists', ListController.getUserLists);
router.post('/user/:userId/assign-list', ListController.assignListToUser);
router.post('/user/:userId/release-all-lists', ListController.releaseAllListToUser);
router.post('/user/bulk-release-lists', ListController.bulkReleaseLists);

router.post('/user/:userId/create-list', ListController.createUserList); // New route for custom lists?
router.put('/user/:userId/list/:listId', ListController.updateUserList);
router.delete('/user/:userId/list/:listId', ListController.deleteUserList);

export default router;
