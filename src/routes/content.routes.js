import express from 'express';
import ContentController from '../controllers/content.controller.js';
import authorize from '../middleware/authorizeMiddleware.js';

const router = express.Router();

router.get('/landing-page', ContentController.getLandingPage);
router.get('/get-landing-page', ContentController.getLandingPage);
router.get('/get-home-page', ContentController.getHomePage);
router.get('/get-premium-plans', ContentController.getPremiumPlans);
router.put('/edit-landing-page', authorize(['admin', 'super-admin']), ContentController.editLandingPage);
router.post('/update-home-page', authorize(['admin', 'super-admin']), ContentController.updateHomePage);
router.get('/get-contact-data', ContentController.getContactData);
router.post('/update-contact-data', authorize(['admin', 'super-admin']), ContentController.updateContactData);
router.get('/search-colleges', ContentController.searchColleges);
router.get('/list-folders', ContentController.getListFolders);
router.post('/list-folder', authorize(['admin', 'super-admin']), ContentController.createListFolder);
router.get('/get-dynamic-pages', ContentController.getDynamicPages);
router.post('/update-dynamic-pages', authorize(['admin', 'super-admin']), ContentController.updateDynamicPages);
router.post('/update-premium-plans', authorize(['admin', 'super-admin']), ContentController.updatePremiumPlans);
router.post('/getcutoff', ContentController.getCutoff);

export default router;
