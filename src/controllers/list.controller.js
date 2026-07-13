import ListService from '../services/list.service.js';
import UserListService from '../services/userList.service.js';

const ListController = {
    async getLists(req, res) {
        try {
            const lists = await ListService.getLists();
            res.status(200).json(lists);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getList(req, res) {
        try {
            const list = await ListService.getList(req.params.listId);
            res.status(200).json(list);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async addList(req, res) {
        try {
            const list = await ListService.addList(req.body, req.admin);
            res.status(201).json(list);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async editList(req, res) {
        try {
            const list = await ListService.editList(req.params.listId, req.body, req.admin);
            res.status(200).json(list);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async deleteList(req, res) {
        try {
            const result = await ListService.deleteList(req.params.listId, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async restoreList(req, res) {
        try {
            const result = await ListService.restoreList(req.params.listId, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async copyListToFolder(req, res) {
        try {
            const result = await ListService.copyListToFolder(req.params.listId, req.params.folderId, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async moveListToFolder(req, res) {
        try {
            const result = await ListService.moveListToFolder(req.params.listId, req.params.folderId, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateListFolder(req, res) {
        try {
            const result = await ListService.updateListFolder(req.params.folderId, req.body, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async deleteListFolder(req, res) {
        try {
            const result = await ListService.deleteListFolder(req.params.folderId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async getUserLists(req, res) {
        try {
            const lists = await UserListService.getUserLists(req.params.userId);
            res.status(200).json(lists);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async assignListToUser(req, res) {
        try {
            const payload = req.body || {};
            const listId = typeof payload === 'string'
                ? payload
                : (payload.originalListId || payload.listId || payload.id);

            if (!listId) {
                return res.status(400).json({ error: 'listId or originalListId is required' });
            }

            const result = await UserListService.assignListToUser(
                req.params.userId,
                listId,
                req.admin,
                payload.title,
                payload
            );
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async releaseListToUser(req, res) {
        try {
            const { userId } = req.params;
            const listId = req.body?.listId || req.body?.id;
            if (!listId) {
                return res.status(400).json({ error: 'listId is required' });
            }
            const result = await UserListService.releaseCreatedListToUser(userId, listId, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async releaseAllListToUser(req, res) {
        try {
            const result = await UserListService.releaseAllListToUser(req.params.userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async bulkReleaseLists(req, res) {
        try {
            const result = await UserListService.bulkReleaseLists(req.body.userIds);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async createUserList(req, res) {
        try {
            const result = await UserListService.createUserList(req.params.userId, req.body, req.admin);
            res.status(201).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateUserList(req, res) {
        try {
            const { userId, listId } = req.params;
            const result = await UserListService.updateUserList(userId, listId, req.body, req.admin);
            res.status(200).json(result.userList || result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateCreatedUserList(req, res) {
        try {
            const { userId, listId } = req.params;
            const result = await UserListService.updateCreatedUserList(userId, listId, req.body, req.admin);
            res.status(200).json(result.userList || result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async deleteUserList(req, res) {
        try {
            const result = await UserListService.deleteUserList(req.params.listId, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async deleteUserCreatedList(req, res) {
        try {
            const result = await UserListService.deleteUserCreatedList(req.params.listId, req.admin);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

export default ListController;
