import { CounsellingForm, RegistrationForm } from '../models/forms.model.js';

class FormService {
    // ─── Counselling Form ─────────────────────────────────────────────────────

    /**
     * Get all counselling form configs.
     * Mirrors admin.service.js getCounsellingFormSteps.
     */
    async getCounsellingForms() {
        try {
            return await CounsellingForm.find().lean();
        } catch (error) {
            throw new Error('Failed to get counselling forms: ' + error.message);
        }
    }

    /**
     * Get steps for a specific counselling form by its string `id`.
     */
    async getCounsellingFormById(formId) {
        try {
            const form = await CounsellingForm.findOne({ id: formId });
            if (!form) throw new Error('Counselling form not found');
            return form;
        } catch (error) {
            throw new Error('Failed to get counselling form: ' + error.message);
        }
    }

    /**
     * Update (or create) a counselling form's steps.
     * Mirrors admin.service.js editFormSteps (lines ~1437–1530).
     * `formId` is the document's string `id` field.
     */
    async editCounsellingFormSteps(formId, steps, adminEmail) {
        try {
            const updated = await CounsellingForm.findOneAndUpdate(
                { id: formId },
                {
                    $set: {
                        steps,
                        lastUpdatedBy: adminEmail,
                        updatedAt: new Date()
                    }
                },
                { new: true, upsert: true }
            );
            return { message: 'Form steps updated successfully', form: updated };
        } catch (error) {
            throw new Error('Failed to edit form steps: ' + error.message);
        }
    }

    /**
     * Save a full counselling form config (upsert by id).
     * Mirrors admin.service.js saveFormConfig.
     */
    async saveFormConfig(formId, formData, adminEmail) {
        try {
            const updated = await CounsellingForm.findOneAndUpdate(
                { id: formId },
                {
                    $set: {
                        ...formData,
                        id: formId,
                        lastUpdatedBy: adminEmail,
                        updatedAt: new Date()
                    }
                },
                { new: true, upsert: true }
            );
            return { message: 'Form config saved successfully', form: updated };
        } catch (error) {
            throw new Error('Failed to save form config: ' + error.message);
        }
    }

    // ─── Registration Form ────────────────────────────────────────────────────

    /**
     * Get registration form by string `id`.
     */
    async getRegistrationForm(formId) {
        try {
            const form = await RegistrationForm.findOne({ id: formId });
            if (!form) throw new Error('Registration form not found');
            return form;
        } catch (error) {
            throw new Error('Failed to get registration form: ' + error.message);
        }
    }

    /**
     * Save / update a registration form config.
     */
    async saveRegistrationFormConfig(formId, formData) {
        try {
            const updated = await RegistrationForm.findOneAndUpdate(
                { id: formId },
                { $set: { ...formData, id: formId, updatedAt: new Date() } },
                { new: true, upsert: true }
            );
            return { message: 'Registration form saved successfully', form: updated };
        } catch (error) {
            throw new Error('Failed to save registration form: ' + error.message);
        }
    }
}

export default new FormService();
