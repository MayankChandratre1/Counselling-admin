import mongoose from 'mongoose';
import { CollegeSchema } from '../../scripts/SchemasV3.js';

export const College = mongoose.models.College
    || mongoose.model('College', CollegeSchema, 'colleges_v4');

export default College;
