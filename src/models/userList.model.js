import mongoose from 'mongoose';
import { UserListSchema, ListCollegeSchema } from '../../scripts/SchemasV3.js';

// UserList = per-user copy of a MasterList, lives in `userlists` collection
export const UserList = mongoose.models.UserList || mongoose.model('UserList', UserListSchema, 'userlists');

export { ListCollegeSchema };
export default UserList;
