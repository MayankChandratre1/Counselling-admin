import AdminService from '../services/admin.service.js';

class AdminController {
    constructor() {
        this.adminService = new AdminService();
    }

    async login(req, res) {
        try {
            const result = await this.adminService.login(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getAllUsers(req, res) {
        try {
            const users = await this.adminService.getAllUsers();
            res.status(200).json(users);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async updateUser(req, res) {
        try {
            const result = await this.adminService.updateUser(req.params.userId, req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const result = await this.adminService.deleteUser(req.params.userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getFormSteps(req, res) {
        try {
            const forms = await this.adminService.getFormSteps();
            res.status(200).json(forms);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async editFormSteps(req, res) {
        try {
            const result = await this.adminService.editFormSteps(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getLists(req, res) {
        try {
            const lists = await this.adminService.getLists();
            res.status(200).json(lists);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async editLists(req, res) {
        try {
            const result = await this.adminService.editLists(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteLists(req, res) {
        try {
            const result = await this.adminService.deleteLists(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getList(req, res) {
        try {
            const list = await this.adminService.getList(req.params.listId);
            res.status(200).json(list);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async editList(req, res) {
        try {
            const result = await this.adminService.editList(req.params.listId, req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteList(req, res) {
        try {
            const result = await this.adminService.deleteList(req.params.listId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getUser(req, res) {
        try {
            const user = await this.adminService.getUser(req.params.userId);
            res.status(200).json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async searchUser(req, res) {
        try {
            const users = await this.adminService.searchUser(req.body);
            res.status(200).json(users);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

// Create instance of controller
const adminController = new AdminController();

// Export controller methods individually
export default {
    login: adminController.login.bind(adminController),
    getAllUsers: adminController.getAllUsers.bind(adminController),
    updateUser: adminController.updateUser.bind(adminController),
    deleteUser: adminController.deleteUser.bind(adminController),
    getFormSteps: adminController.getFormSteps.bind(adminController),
    editFormSteps: adminController.editFormSteps.bind(adminController),
    getLists: adminController.getLists.bind(adminController),
    editLists: adminController.editLists.bind(adminController),
    deleteLists: adminController.deleteLists.bind(adminController),
    getList: adminController.getList.bind(adminController),
    editList: adminController.editList.bind(adminController),
    deleteList: adminController.deleteList.bind(adminController),
    getUser: adminController.getUser.bind(adminController),
    searchUser: adminController.searchUser.bind(adminController)
};
