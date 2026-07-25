import mongoose from 'mongoose';

/**
 * Lean activity log — no versionKey, no createdAt/updatedAt duplicates.
 * (Older docs may still have id / createdAt / updatedAt / __v.)
 */
const AdminActivitySchema = new mongoose.Schema(
    {
        adminId: { type: String, required: true, index: true },
        adminEmail: { type: String, index: true },
        method: { type: String, required: true },
        path: { type: String, required: true, index: true },
        timestamp: { type: Date, required: true, index: true },
    },
    { versionKey: false, timestamps: false }
);

export const AdminActivity =
    mongoose.models.AdminActivity ||
    mongoose.model('AdminActivity', AdminActivitySchema, 'admin_activities');

export default AdminActivity;
