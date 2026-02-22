import express from 'express';
import ContentController from '../controllers/content.controller.js';
import authorize from '../middleware/authorizeMiddleware.js';

const router = express.Router();

router.get('/get-landing-page', ContentController.getLandingPage);
router.get('/get-premium-plans', ContentController.getPremiumPlans);
router.put('/edit-landing-page', authorize(['admin', 'super-admin']), ContentController.editLandingPage);
router.get('/search-colleges', ContentController.searchColleges);
router.get('/list-folders', ContentController.getListFolders);
router.post('/list-folder', authorize(['admin', 'super-admin']), ContentController.createListFolder);
router.get('/get-dynamic-pages', ContentController.getDynamicPages);

export default router;
