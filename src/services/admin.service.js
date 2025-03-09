import { db } from '../config/mongodb.js';

class AdminService {
    constructor(){
        this.db = db;
        this.users = db.collection('users');
        this.admins = db.collection('admins');
        this.counsellingForms = db.collection('counsellingForms');
        this.lists = db.collection('lists');
    }

    async login(credentials) {
        const admin = await this.admins.findOne({ email: credentials.email });
        if (!admin) throw new Error('Admin not found');
        // Add password verification logic here
        return { token: 'generate-jwt-token-here' };
    }

    async getAllUsers() {
        return await this.users.find({}).toArray();
    }

    async updateUser(userId, userData) {
        const result = await this.users.updateOne(
            { id: userId },
            { $set: userData }
        );
        if (!result.modifiedCount) throw new Error('User update failed');
        return { message: 'User updated successfully' };
    }

    async deleteUser(userId) {
        const result = await this.users.deleteOne({ _id: userId });
        if (!result.deletedCount) throw new Error('User deletion failed');
        return { message: 'User deleted successfully' };
    }

    async getUser(userId) {
        const user = await this.users.findOne({ id: userId });
        if (!user) throw new Error('User not found');
        return user;
    }

    async searchUser(searchCriteria) {
        const query = {};
        if (searchCriteria.name) {
            query.name = { $regex: searchCriteria.name, $options: 'i' };
        }
        if (searchCriteria.number) {
            query.number = { $regex: searchCriteria.number, $options: 'i' };
        }
        return await this.users.find(query).toArray();
    }

    async getFormSteps() {
        return await this.counsellingForms.find({}).toArray();
    }

    async editFormSteps(formData) {
        const result = await this.counsellingForms.updateOne(
            { id: formData.id },
            { $set: formData },
            { upsert: true }
        );
        return { message: 'Form steps updated successfully' };
    }

    async getLists() {
        return await this.lists.find({}).toArray();
    }

    async editLists(listsData) {
        const result = await this.lists.updateMany(
            {},
            { $set: listsData }
        );
        return { message: 'Lists updated successfully' };
    }

    async deleteLists(listIds) {
        const result = await this.lists.deleteMany(
            { _id: { $in: listIds } }
        );
        return { message: 'Lists deleted successfully' };
    }

    async getList(listId) {
        const list = await this.lists.findOne({ _id: listId });
        if (!list) throw new Error('List not found');
        return list;
    }

    async editList(listId, listData) {
        const result = await this.lists.updateOne(
            { _id: listId },
            { $set: listData }
        );
        if (!result.modifiedCount) throw new Error('List update failed');
        return { message: 'List updated successfully' };
    }

    async deleteList(listId) {
        const result = await this.lists.deleteOne({ _id: listId });
        if (!result.deletedCount) throw new Error('List deletion failed');
        return { message: 'List deleted successfully' };
    }
}

export default AdminService;
