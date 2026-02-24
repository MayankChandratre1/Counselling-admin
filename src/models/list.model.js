import mongoose from 'mongoose';
import { MasterListSchema } from '../../scripts/SchemasV3.js';

// MasterList maps to the `masterlists` collection — admin-curated lists that are the source of truth.
// Per-user copies live in UserList (userList.model.js, collection: userlists)
export const MasterList = mongoose.models.MasterList || mongoose.model('MasterList', MasterListSchema, 'masterlists');
export default MasterList;
