import mongoose from 'mongoose';
import { UserSchema } from '../../scripts/SchemasV3.js';

export const User = mongoose.models.User || mongoose.model('User', UserSchema, 'users');
export default User;
