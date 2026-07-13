import { MasterList } from '../models/list.model.js';
import { UserList } from '../models/userList.model.js';
import { ListFolder } from '../models/misc.model.js';
import mongoose from 'mongoose';
import cache from '../config/cache.js';

class ListService {
    invalidateCache(pattern) {
        const cleanPattern = pattern.replace(/\*/g, '');
        const keys = cache.keys();
        const matches = keys.filter(k => k.includes(cleanPattern));
        if (matches.length > 0) cache.del(matches);
    }

    // ── Master Lists ──────────────────────────────────────────────────────────

    async getLists(folderId = null) {
        try {
            const query = {};
            if (folderId) query.folderId = folderId;
            return await MasterList.find(query).sort({ createdAt: -1 }).lean();
        } catch (error) {
            throw new Error('Failed to get lists: ' + error.message);
        }
    }

    async getList(listId) {
        try {
            const list = await MasterList.findOne({ id: listId }).lean();
            if (!list) throw new Error('List not found');
            return list;
        } catch (error) {
            throw new Error('Failed to get list: ' + error.message);
        }
    }

    /**
     * Create a master list.
     * Mirrors admin.service.js createList (lines ~604–668).
     */
    async createList(listData, admin) {
        try {
            const id = 'list_' + Date.now();
            const list = new MasterList({
                ...listData,
                id,
                createdBy: admin.email,
                lastUpdatedBy: admin.email
            });
            await list.save();

            // Increment folder list count
            if (listData.folderId) {
                await ListFolder.findOneAndUpdate(
                    { id: listData.folderId },
                    { $inc: { list_count: 1 } }
                );
            }

            this.invalidateCache('lists:*');
            return list;
        } catch (error) {
            throw new Error('Failed to create list: ' + error.message);
        }
    }

    /**
     * Wrapper for createList to match controller naming convention
     */
    async addList(listData, admin) {
        return this.createList(listData, admin);
    }

    /**
     * Update a master list's metadata (not colleges array — use updateListColleges for that).
     * Mirrors admin.service.js updateList.
     */
    async updateList(listId, listData, admin) {
        try {
            const updated = await MasterList.findOneAndUpdate(
                { id: listId },
                { $set: { ...listData, lastUpdatedBy: admin.email } },
                { new: true }
            );
            if (!updated) throw new Error('List not found');
            this.invalidateCache('lists:*');
            this.invalidateCache(`list:${listId}`);
            return updated;
        } catch (error) {
            throw new Error('Failed to update list: ' + error.message);
        }
    }

    /**
     * Wrapper for updateList to match controller naming convention
     */
    async editList(listId, listData, admin) {
        return this.updateList(listId, listData, admin);
    }

    /**
     * Replace the colleges array on a MasterList.
     */
    async updateListColleges(listId, colleges, admin) {
        try {
            const updated = await MasterList.findOneAndUpdate(
                { id: listId },
                { $set: { colleges, lastUpdatedBy: admin.email } },
                { new: true }
            );
            if (!updated) throw new Error('List not found');
            this.invalidateCache(`list:${listId}`);
            return updated;
        } catch (error) {
            throw new Error('Failed to update list colleges: ' + error.message);
        }
    }

    /**
     * Soft-delete a master list (marks isDeleted, moves to archive folder).
     * Mirrors admin.service.js deleteList (lines ~1303–1380).
     */
    async deleteList(listId, admin) {
        try {
            let list = await MasterList.findOne({ id: listId });
            if (!list && mongoose.Types.ObjectId.isValid(listId)) {
                list = await MasterList.findOne({ _id: listId });
            }
            if (!list) throw new Error('List not found');

            const originalFolderId = list.folderId;
            const adminEmail = admin?.email || 'system';

            const updateFilter = list.id ? { id: list.id } : { _id: list._id };
            await MasterList.findOneAndUpdate(
                updateFilter,
                {
                    $set: {
                        folderId: null,
                        isDeleted: true,
                        deletedAt: new Date(),
                        deleteFolderId: 'archive_1',
                        lastUpdatedBy: adminEmail
                    }
                }
            );

            // Update folder counts
            if (originalFolderId) {
                await ListFolder.findOneAndUpdate({ id: originalFolderId }, { $inc: { list_count: -1 } });
            }
            await ListFolder.findOneAndUpdate({ id: 'archive_1' }, { $inc: { list_count: 1 } });

            this.invalidateCache('lists:*');
            return { message: 'List deleted (soft) successfully', deleteFolderId: 'archive_1' };
        } catch (error) {
            throw new Error('Failed to delete list: ' + error.message);
        }
    }

    /**
     * Restore a soft-deleted list back to its original folder.
     * Mirrors admin.service.js restoreList (lines 2997–3055).
     */
    async restoreList(listId, admin) {
        try {
            let list = await MasterList.findOne({ id: listId });
            if (!list && mongoose.Types.ObjectId.isValid(listId)) {
                list = await MasterList.findOne({ _id: listId });
            }
            if (!list) throw new Error('List not found');
            if (!list.isDeleted) throw new Error('List is not marked as deleted');

            const adminEmail = admin?.email || 'system';
            const updateFilter = list.id ? { id: list.id } : { _id: list._id };

            await MasterList.findOneAndUpdate(
                updateFilter,
                {
                    $set: {
                        folderId: '',
                        isDeleted: false,
                        deletedAt: null,
                        deleteFolderId: null,
                        lastUpdatedBy: adminEmail
                    }
                }
            );

            await ListFolder.findOneAndUpdate({ id: 'archive_1' }, { $inc: { list_count: -1 } });

            this.invalidateCache('lists:*');
            return { message: 'List restored successfully', listId: list.id || listId, folderId: '' };
        } catch (error) {
            throw new Error('List restoration failed: ' + error.message);
        }
    }

    /**
     * Copy a list to another folder.
     * Mirrors admin.service.js copyListToFolder (lines 3057–3108).
     */
    async copyListToFolder(listId, targetFolderId, admin) {
        try {
            const list = await MasterList.findOne({ id: listId }).lean();
            if (!list) throw new Error('List not found');

            const folder = await ListFolder.findOne({ id: targetFolderId });
            if (!folder) throw new Error('Target folder not found');

            const newId = 'list_' + Date.now();
            const newList = new MasterList({
                ...list,
                _id: undefined,
                id: newId,
                folderId: targetFolderId,
                title: `${list.title} (Copy)`,
                createdBy: admin.email,
                lastUpdatedBy: admin.email,
                isDeleted: false,
                deletedAt: null,
                deleteFolderId: null,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await newList.save();

            await ListFolder.findOneAndUpdate({ id: targetFolderId }, { $inc: { list_count: 1 } });

            this.invalidateCache('lists:*');
            return { message: 'List copied successfully', newListId: newId };
        } catch (error) {
            throw new Error('Failed to copy list: ' + error.message);
        }
    }

    /**
     * Move a list to another folder.
     * Mirrors admin.service.js moveListToFolder (lines 3110–3161).
     */
    async moveListToFolder(listId, targetFolderId, admin) {
        try {
            const list = await MasterList.findOne({ id: listId });
            if (!list) throw new Error('List not found');

            // "No Folder" is represented by sentinel values from the client; normalize to null.
            const isNoFolder = !targetFolderId ||
                targetFolderId === 'null' ||
                targetFolderId === 'no-folder' ||
                targetFolderId === 'none';
            const normalizedTarget = isNoFolder ? null : targetFolderId;

            const originalFolderId = list.folderId || null;
            if (originalFolderId === normalizedTarget) {
                return { message: 'List is already in the target folder' };
            }

            if (!isNoFolder) {
                const targetFolder = await ListFolder.findOne({ id: normalizedTarget });
                if (!targetFolder) throw new Error('Target folder not found');
            }

            await MasterList.findOneAndUpdate(
                { id: listId },
                { $set: { folderId: normalizedTarget, lastUpdatedBy: admin.email } }
            );

            if (originalFolderId) {
                await ListFolder.findOneAndUpdate({ id: originalFolderId }, { $inc: { list_count: -1 } });
            }
            if (!isNoFolder) {
                await ListFolder.findOneAndUpdate({ id: normalizedTarget }, { $inc: { list_count: 1 } });
            }

            this.invalidateCache('lists:*');
            this.invalidateCache(`list:${listId}`);
            this.invalidateCache('list_folders:*');
            return { message: 'List moved successfully' };
        } catch (error) {
            throw new Error('Failed to move list: ' + error.message);
        }
    }

    // ── List Folders ──────────────────────────────────────────────────────────

    async getListFolders() {
        try {
            return await ListFolder.find().sort({ createdAt: -1 }).lean();
        } catch (error) {
            throw new Error('Failed to get list folders: ' + error.message);
        }
    }

    async getListFolder(folderId) {
        try {
            const folder = await ListFolder.findOne({ id: folderId }).lean();
            if (!folder) throw new Error('List folder not found');
            return folder;
        } catch (error) {
            throw new Error('Failed to get list folder: ' + error.message);
        }
    }

    async createListFolder(folderData, admin) {
        try {
            const id = 'folder_' + Date.now();
            const folder = new ListFolder({
                ...folderData,
                id,
                createdBy: admin.email,
                list_count: 0
            });
            await folder.save();
            this.invalidateCache('list_folders:*');
            return folder;
        } catch (error) {
            throw new Error('Failed to create list folder: ' + error.message);
        }
    }

    async updateListFolder(folderId, folderData, admin) {
        try {
            const updated = await ListFolder.findOneAndUpdate(
                { id: folderId },
                { $set: folderData },
                { new: true }
            );
            if (!updated) throw new Error('List folder not found');
            this.invalidateCache('list_folders:*');
            return updated;
        } catch (error) {
            throw new Error('Failed to update list folder: ' + error.message);
        }
    }

    async deleteListFolder(folderId) {
        try {
            const folder = await ListFolder.findOne({ id: folderId });
            if (!folder) throw new Error('List folder not found');

            // Soft-delete all lists in this folder (move to archive)
            await MasterList.updateMany(
                { folderId, isDeleted: { $ne: true } },
                {
                    $set: {
                        folderId: null,
                        isDeleted: true,
                        deletedAt: new Date(),
                        deleteFolderId: 'archive_1'
                    }
                }
            );

            await ListFolder.deleteOne({ id: folderId });
            this.invalidateCache('list_folders:*');
            this.invalidateCache('lists:*');
            return { message: 'List folder deleted successfully' };
        } catch (error) {
            throw new Error('Failed to delete list folder: ' + error.message);
        }
    }

    async archiveListFolder(folderId, isArchive) {
        try {
            const updated = await ListFolder.findOneAndUpdate(
                { id: folderId },
                { $set: { isArchive } },
                { new: true }
            );
            if (!updated) throw new Error('List folder not found');
            this.invalidateCache('list_folders:*');
            return {
                id: folderId,
                isArchive,
                message: `Folder ${isArchive ? 'archived' : 'unarchived'} successfully`
            };
        } catch (error) {
            throw new Error('Failed to archive list folder: ' + error.message);
        }
    }
}

export default new ListService();
