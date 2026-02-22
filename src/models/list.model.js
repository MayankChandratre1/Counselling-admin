import mongoose from 'mongoose';
import { MasterListSchema } from '../../scripts/SchemasV3.js';

// MasterList maps to the `lists` collection — admin-curated lists that are the source of truth.
// Per-user copies live in UserList (userList.model.js, collection: user_lists)
export const MasterList = mongoose.models.MasterList || mongoose.model('MasterList', MasterListSchema, 'lists');
export default MasterList;
