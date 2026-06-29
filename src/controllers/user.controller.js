import UserService from '../services/user.service.js';

const UserController = {
    async getAllUsers(req, res) {
        try {
            const { page, limit, lastDoc, ...filters } = req.query;
            const result = await UserService.getAllUsers(page, limit, filters);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async exportUsers(req, res) {
        try {
            const { page, limit, lastDoc, ...filters } = req.query;
            const result = await UserService.exportUsers(filters);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getAllUsersOfForm(req, res) {
        try {
            const formId = req.params.formId;
            const { userIds } = req.body;
            const users = await UserService.getAllUsersOfForm(formId, userIds);
            res.status(200).json(users);
        } catch (error) {
            console.error('Get all users of form error:', error);
            res.status(400).json({ error: error.message });
        }
    },

    async getUser(req, res) {
        try {
            const user = await UserService.getUser(req.params.userId);
            res.status(200).json(user);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    },

    async addUser(req, res) {
        try {
            const user = await UserService.addUser(req.body);
            res.status(201).json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateUser(req, res) {
        try {
            const user = await UserService.updateUser(req.params.userId, req.body);
            res.status(200).json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async deleteUser(req, res) {
        try {
            const result = await UserService.deleteUser(req.params.userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async searchUser(req, res) {
        try {
            // Mongoose's $regex fails if passed a JSON object. We must pass a string.
            const queryRaw = req.body;
            const searchString = typeof queryRaw === 'string' ? queryRaw : (queryRaw.searchQuery || queryRaw.name || queryRaw.phone || '');
            const users = await UserService.searchUser(searchString);
            res.status(200).json(users);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

export default UserController;
