import mongoose from 'mongoose';
import {
    CounsellingFormSchema,
    RegistrationFormSchema
} from '../../scripts/SchemasV3.js';

// CounsellingFormStepSchema is already embedded in CounsellingFormSchema
export const CounsellingForm = mongoose.models.CounsellingForm
    || mongoose.model('CounsellingForm', CounsellingFormSchema, 'counsellingforms');

// RegistrationFormStepSchema is already embedded in RegistrationFormSchema
export const RegistrationForm = mongoose.models.RegistrationForm
    || mongoose.model('RegistrationForm', RegistrationFormSchema, 'registrationforms');
