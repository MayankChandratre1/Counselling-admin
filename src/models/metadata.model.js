import mongoose from 'mongoose';
import { MetadataSchema } from '../../scripts/SchemasV3.js';

// MetadataSchema §18 — includes userIdList[] → User.id, enabled[], total[], version
export const Metadata = mongoose.models.Metadata
    || mongoose.model('Metadata', MetadataSchema, 'metadata');

export default Metadata;
