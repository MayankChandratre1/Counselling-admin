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
            const result = await ListService.deleteList(req.params.listId);
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
            const result = await UserListService.assignListToUser(req.params.userId, req.body);
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
            const result = await UserListService.createUserList(req.params.userId, req.body);
            res.status(201).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateUserList(req, res) {
        try {
            const result = await UserListService.updateUserList(req.params.userId, req.params.listId, req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async deleteUserList(req, res) {
        try {
            const result = await UserListService.deleteUserList(req.params.userId, req.params.listId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

export default ListController;
