import mongoose from 'mongoose';
import { UserList } from '../models/userList.model.js';
import { MasterList } from '../models/list.model.js';
import { User } from '../models/user.model.js';
import cache from '../config/cache.js';

/**
 * UserListService — manages per-user list assignments.
 *
 * In the Firestore model, lists were stored inline in User.lists[] and User.createdList[].
 * In MongoDB the data was migrated into the `user_lists` collection (UserList model).
 * Each document in user_lists has:
 *   - id         : unique string id
 *   - userId     : → User.id
 *   - originalListId : → MasterList.id (null for user-created lists)
 *   - type       : 'assigned' | 'created'
 *   - title, colleges[], isCustomized, lastUpdatedBy
 */
class UserListService {
    invalidateCache(pattern) {
        const cleanPattern = pattern.replace(/\*/g, '');
        cache.del(cache.keys().filter(k => k.includes(cleanPattern)));
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    /**
     * Get all lists for a user (both assigned and created).
     * Mirrors admin.service.js getUserLists.
     */
    async getUserLists(userId) {
        try {
            return await UserList.find({ userId }).sort({ createdAt: -1 }).lean();
        } catch (error) {
            throw new Error('Failed to get user lists: ' + error.message);
        }
    }

    async getUserList(userListId) {
        try {
            const list = await UserList.findOne({ id: userListId }).lean();
            if (!list) throw new Error('User list not found');
            return list;
        } catch (error) {
            throw new Error('Failed to get user list: ' + error.message);
        }
    }

    // ── Assign / Create ───────────────────────────────────────────────────────

    /**
     * Assign a MasterList to a user (creates a UserList copy).
     * Mirrors admin.service.js assignListToUser (lines ~913–1010).
     */
    async assignListToUser(userId, listId, admin, overrideTitle = null, assignmentPayload = null) {
        try {
            const payload = assignmentPayload && typeof assignmentPayload === 'object' ? assignmentPayload : null;
            const payloadHasCopyData = !!(payload && (Array.isArray(payload.colleges) || payload.title));

            const masterList = listId
                ? await MasterList.findOne({ id: listId }).lean()
                : null;

            if (!masterList && !payloadHasCopyData) throw new Error('List not found');

            const user = await User.findOne({ id: userId });
            if (!user) throw new Error('User not found');

            // Check if already assigned/created
            const sourceOriginalListId = payload?.originalListId || masterList?.id || null;

            if (sourceOriginalListId) {
                const existing = await UserList.findOne({ userId, originalListId: sourceOriginalListId });
                if (existing) throw new Error('List already assigned to this user');
            }

            const userListId = payload?.id || ('ul_' + Date.now());
            const colleges = Array.isArray(payload?.colleges)
                ? payload.colleges
                : (masterList?.colleges || []);
            const title = overrideTitle || payload?.title || masterList?.title || 'Assigned List';
            // Policy: newly assigned lists start life as a "created" (draft) list.
            // They only become released ('assigned') via an explicit release action.
            const userList = new UserList({
                id: userListId,
                userId,
                originalListId: sourceOriginalListId,
                type: 'created',
                title,
                colleges,
                isCustomized: !!(payload?.isCustomized ?? payload?.customized ?? false),
                customized: !!(payload?.customized ?? payload?.isCustomized ?? false),
                lastUpdatedBy: admin?.email || 'system'
            });
            await userList.save();

            this.invalidateCache(`userlists:${userId}`);
            return { message: 'List assigned successfully', userList };
        } catch (error) {
            throw new Error('Failed to assign list: ' + error.message);
        }
    }

    /**
     * Create a new user-created list (not from a MasterList).
     * Mirrors admin.service.js createUserList.
     */
    async createUserList(userId, listData, admin) {
        try {
            const userListId = 'ul_' + Date.now();
            const userList = new UserList({
                id: userListId,
                userId,
                type: 'created',
                title: listData.title,
                colleges: listData.colleges || [],
                isCustomized: false,
                lastUpdatedBy: admin.email
            });
            await userList.save();
            this.invalidateCache(`userlists:${userId}`);
            return { message: 'User list created', userList };
        } catch (error) {
            throw new Error('Failed to create user list: ' + error.message);
        }
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * Update an assigned user list (colleges, customization).
     * Mirrors admin.service.js updateUserList (lines ~1011–1100).
     */
    async updateUserList(userId, userListId, updateData, admin) {
        try {
            const updateSet = {
                ...updateData,
                isCustomized: true,
                customized: true,
                lastUpdatedBy: admin.email
            };

            // Try to find by id field first, then fallback to MongoDB _id
            // Use both userId and listId for more accurate lookup
            let query = { id: userListId, userId };
            let updated = await UserList.findOneAndUpdate(
                query,
                { $set: updateSet },
                { new: true }
            );
            
            // If not found by id field, try MongoDB _id (only if it's a valid ObjectId)
            if (!updated && mongoose.Types.ObjectId.isValid(userListId)) {
                updated = await UserList.findOneAndUpdate(
                    { _id: userListId, userId },
                    { $set: updateSet },
                    { new: true }
                );
            }
            
            // Last resort: try just by id if userId doesn't match (for legacy data)
            if (!updated) {
                updated = await UserList.findOneAndUpdate(
                    { id: userListId },
                    { $set: updateSet },
                    { new: true }
                );
            }
            
            if (!updated) throw new Error('User list not found');
            this.invalidateCache(`userlists:${updated.userId}`);
            return { message: 'User list updated', userList: updated };
        } catch (error) {
            throw new Error('Failed to update user list: ' + error.message);
        }
    }

    /**
     * Update a user-created list.
     * Mirrors admin.service.js updateCreatedUserList.
     */
    async updateCreatedUserList(userId, userListId, updateData, admin) {
        try {
            const updateSet = { ...updateData, lastUpdatedBy: admin.email };

            // Try to find by id field first, then fallback to MongoDB _id
            // Use both userId and listId for more accurate lookup
            let query = { id: userListId, userId, type: 'created' };
            let updated = await UserList.findOneAndUpdate(
                query,
                { $set: updateSet },
                { new: true }
            );
            
            // If not found by id field, try MongoDB _id (only if it's a valid ObjectId)
            if (!updated && mongoose.Types.ObjectId.isValid(userListId)) {
                updated = await UserList.findOneAndUpdate(
                    { _id: userListId, userId, type: 'created' },
                    { $set: updateSet },
                    { new: true }
                );
            }
            
            // Last resort: try just by id if userId doesn't match (for legacy data)
            if (!updated) {
                updated = await UserList.findOneAndUpdate(
                    { id: userListId, type: 'created' },
                    { $set: updateSet },
                    { new: true }
                );
            }
            
            if (!updated) throw new Error('User list not found or not a created list');
            this.invalidateCache(`userlists:${updated.userId}`);
            return { message: 'User list updated', userList: updated };
        } catch (error) {
            throw new Error('Failed to update created user list: ' + error.message);
        }
    }

    // ── Release ───────────────────────────────────────────────────────────────

    /**
     * Release (remove) an assigned list from a user.
     * Mirrors admin.service.js releaseListToUser (lines ~1101–1200).
     */
    async releaseListFromUser(userId, userListId, admin) {
        try {
            // Try to find by id field first, then fallback to MongoDB _id
            let userList = await UserList.findOne({ id: userListId, userId });
            
            if (!userList && mongoose.Types.ObjectId.isValid(userListId)) {
                userList = await UserList.findOne({ _id: userListId, userId });
            }
            
            if (!userList) throw new Error('User list not found');

            const originalListId = userList.originalListId;

            // Try delete by id field first
            let deleteResult = await UserList.deleteOne({ id: userListId });
            
            // If no documents deleted and _id is valid, try that
            if (deleteResult.deletedCount === 0 && mongoose.Types.ObjectId.isValid(userListId)) {
                deleteResult = await UserList.deleteOne({ _id: userListId });
            }

            // Remove from MasterList.userIds
            if (originalListId) {
                await MasterList.findOneAndUpdate(
                    { id: originalListId },
                    { $pull: { userIds: userId } }
                );
            }

            this.invalidateCache(`userlists:${userId}`);
            return { message: 'List released from user successfully' };
        } catch (error) {
            throw new Error('Failed to release list: ' + error.message);
        }
    }

    /**
     * Release ALL assigned lists from a user.
     * Mirrors admin.service.js releaseAllListToUser.
     */
    async releaseAllListsFromUser(userId, admin) {
        try {
            const userLists = await UserList.find({ userId, type: 'assigned' }).lean();

            // Remove user from each MasterList.userIds
            const masterListIds = userLists.map(ul => ul.originalListId).filter(Boolean);
            if (masterListIds.length > 0) {
                await MasterList.updateMany(
                    { id: { $in: masterListIds } },
                    { $pull: { userIds: userId } }
                );
            }

            await UserList.deleteMany({ userId, type: 'assigned' });

            this.invalidateCache(`userlists:${userId}`);
            return { message: `Released ${userLists.length} lists from user`, count: userLists.length };
        } catch (error) {
            throw new Error('Failed to release all lists: ' + error.message);
        }
    }

    /**
     * Release a single created (draft) list for a user (converts created -> assigned).
     * After release the list becomes visible to the end user.
     */
    async releaseCreatedListToUser(userId, userListId, admin) {
        try {
            let updated = await UserList.findOneAndUpdate(
                { id: userListId, userId, type: 'created' },
                { $set: { type: 'assigned', lastUpdatedBy: admin?.email || 'system' } },
                { new: true }
            );

            if (!updated && mongoose.Types.ObjectId.isValid(userListId)) {
                updated = await UserList.findOneAndUpdate(
                    { _id: userListId, userId, type: 'created' },
                    { $set: { type: 'assigned', lastUpdatedBy: admin?.email || 'system' } },
                    { new: true }
                );
            }

            // Legacy fallback: match by id without strict userId
            if (!updated) {
                updated = await UserList.findOneAndUpdate(
                    { id: userListId, type: 'created' },
                    { $set: { type: 'assigned', lastUpdatedBy: admin?.email || 'system' } },
                    { new: true }
                );
            }

            if (!updated) throw new Error('Created list not found for this user');

            // Link the user to the master list now that it is released
            if (updated.originalListId) {
                await MasterList.findOneAndUpdate(
                    { id: updated.originalListId },
                    { $addToSet: { userIds: updated.userId } }
                );
            }

            this.invalidateCache(`userlists:${updated.userId}`);
            return { message: 'List released to user successfully', userList: updated };
        } catch (error) {
            throw new Error('Failed to release list: ' + error.message);
        }
    }

    /**
     * "Release" all created lists for a single user (converts created -> assigned).
     * Mirrors the old Firebase logic that took createdLists and moved them to lists.
     */
    async releaseAllListToUser(userId) {
        try {
            const updated = await UserList.updateMany(
                { userId, type: 'created' },
                { $set: { type: 'assigned' } }
            );
            this.invalidateCache(`userlists:${userId}`);
            return { message: 'All created lists released to user successfully', count: updated.modifiedCount };
        } catch (error) {
            throw new Error('Failed to release all lists to user: ' + error.message);
        }
    }

    /**
     * "Release" all created lists for multiple users in bulk (converts created -> assigned).
     */
    async bulkReleaseLists(userIds) {
        try {
            if (!Array.isArray(userIds) || userIds.length === 0) {
                return { message: 'No users selected' };
            }
            const updated = await UserList.updateMany(
                { userId: { $in: userIds }, type: 'created' },
                { $set: { type: 'assigned' } }
            );
            this.invalidateCache('userlists:*');
            return { message: `All lists released to ${userIds.length} users successfully`, count: updated.modifiedCount };
        } catch (error) {
            throw new Error('Failed to bulk release lists: ' + error.message);
        }
    }

    /**
     * Bulk-release a master list from ALL users it was assigned to.
     * Mirrors admin.service.js releaseAllListBulk.
     */
    async releaseListFromAllUsers(listId, admin) {
        try {
            const masterList = await MasterList.findOne({ id: listId });
            if (!masterList) throw new Error('List not found');

            const result = await UserList.deleteMany({ originalListId: listId, type: 'assigned' });

            await MasterList.findOneAndUpdate(
                { id: listId },
                { $set: { userIds: [] } }
            );

            this.invalidateCache('userlists:*');
            return {
                message: `List released from all users`,
                releasedCount: result.deletedCount
            };
        } catch (error) {
            throw new Error('Failed to bulk-release list: ' + error.message);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * Delete a user's assigned list entry.
     * Mirrors admin.service.js deleteUserList.
     */
    async deleteUserList(userListId, admin) {
        try {
            // Try to find by id field first, then fallback to MongoDB _id
            let userList = await UserList.findOne({ id: userListId });
            
            if (!userList && mongoose.Types.ObjectId.isValid(userListId)) {
                userList = await UserList.findOne({ _id: userListId });
            }
            
            if (!userList) throw new Error('User list not found');

            const { userId, originalListId } = userList;
            
            // Try delete by id field first
            let deleteResult = await UserList.deleteOne({ id: userListId });
            
            // If no documents deleted and _id is valid, try that
            if (deleteResult.deletedCount === 0 && mongoose.Types.ObjectId.isValid(userListId)) {
                deleteResult = await UserList.deleteOne({ _id: userListId });
            }

            if (originalListId) {
                await MasterList.findOneAndUpdate(
                    { id: originalListId },
                    { $pull: { userIds: userId } }
                );
            }

            this.invalidateCache(`userlists:${userId}`);
            return { message: 'User list deleted successfully' };
        } catch (error) {
            throw new Error('Failed to delete user list: ' + error.message);
        }
    }

    /**
     * Delete a user-created list.
     * Mirrors admin.service.js deleteUserCreatedList.
     */
    async deleteUserCreatedList(userListId, admin) {
        try {
            // Try to find by id field first, then fallback to MongoDB _id
            let userList = await UserList.findOne({ id: userListId, type: 'created' });
            
            if (!userList && mongoose.Types.ObjectId.isValid(userListId)) {
                userList = await UserList.findOne({ _id: userListId, type: 'created' });
            }
            
            if (!userList) throw new Error('User created list not found');

            // Try delete by id field first
            let deleteResult = await UserList.deleteOne({ id: userListId });
            
            // If no documents deleted and _id is valid, try that
            if (deleteResult.deletedCount === 0 && mongoose.Types.ObjectId.isValid(userListId)) {
                deleteResult = await UserList.deleteOne({ _id: userListId });
            }
            
            this.invalidateCache(`userlists:${userList.userId}`);
            return { message: 'User created list deleted successfully' };
        } catch (error) {
            throw new Error('Failed to delete user created list: ' + error.message);
        }
    }
}

export default new UserListService();
