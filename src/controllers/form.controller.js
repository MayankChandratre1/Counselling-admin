import FormService from '../services/form.service.js';

const FormController = {
    async getFormSteps(req, res) {
        try {
            const steps = await FormService.getCounsellingForms();
            res.status(200).json(steps);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async editFormSteps(req, res) {
        try {
            const result = await FormService.editFormSteps(req.body, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getFormConfig(req, res) {
        try {
            // 'Form1' was the hardcoded ID used in the legacy Firebase system
            const result = await FormService.getRegistrationForm('Form1');
            res.status(200).json(result);
        } catch (error) {
            if (error.message.includes('not found')) {
                // Return default empty config if not found to gracefully initialize
                return res.status(200).json({ steps: [], updatedAt: new Date().toISOString() });
            }
            res.status(500).json({ error: error.message });
        }
    },

    async saveFormConfig(req, res) {
        try {
            const result = await FormService.saveRegistrationFormConfig('Form1', { steps: req.body.steps });
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

export default FormController;
