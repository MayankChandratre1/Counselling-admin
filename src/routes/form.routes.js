import express from 'express';
import FormController from '../controllers/form.controller.js';
import authorize from '../middleware/authorizeMiddleware.js';

const router = express.Router();

router.get('/formsteps', FormController.getFormSteps);
router.post('/edit-formsteps', authorize(['admin', 'super-admin']), FormController.editFormSteps);
router.delete('/delete-form/:formId', authorize(['admin', 'super-admin']), FormController.deleteForm);
router.get('/form-config', FormController.getFormConfig);
router.post('/form-config', FormController.saveFormConfig); // authorize?

export default router;
