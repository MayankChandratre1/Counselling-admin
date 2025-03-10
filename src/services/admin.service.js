import { db } from "../../config/firebase.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class AdminService {
    constructor(){
        this.db = db;
        this.users = db.collection('users');
        this.admins = db.collection('admins');
        this.counsellingForms = db.collection('counsellingForms');
        this.lists = db.collection('lists');
    }

    async login(credentials) {
        const adminRef = await this.admins.where('email', '==', credentials.email).get();
        if (adminRef.empty) throw new Error('Admin not found');
        
        const admin = adminRef.docs[0].data();
        const adminId = adminRef.docs[0].id;
        
        const isPasswordValid = await bcrypt.compare(credentials.password, admin.password);
        if (!isPasswordValid) throw new Error('Invalid password');

        const token = jwt.sign(
            { 
                id: adminId,
                email: admin.email,
                role: 'admin'
            }, 
            process.env.JWT_ADMIN_SECRET 
           );

        return { 
            token,
            admin: {
                id: adminId,
                email: admin.email,
                name: admin.name
            }
        };
    }

    async getAllUsers() {
        const snapshot = await this.users.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async updateUser(userId, userData) {
        try {
            await this.users.doc(userId).update(userData);
            return { message: 'User updated successfully' };
        } catch (error) {
            throw new Error('User update failed');
        }
    }

    async deleteUser(userId) {
        try {
            await this.users.doc(userId).delete();
            return { message: 'User deleted successfully' };
        } catch (error) {
            throw new Error('User deletion failed');
        }
    }

    async getUser(userId) {
        const userDoc = await this.users.doc(userId).get();
        if (!userDoc.exists) throw new Error('User not found');
        return { id: userDoc.id, ...userDoc.data() };
    }

    async searchUser(searchCriteria) {
        let query = this.users;
        

        if (searchCriteria.name) {
            query = query.where('name', '>=', searchCriteria.name)
                        .where('name', '<=', searchCriteria.name + '\uf8ff');
        }
        if (searchCriteria.phone) {
            query = query.where('phone', '==', searchCriteria.phone);
        }
        if (searchCriteria.cetSeatNumber) {
            query = query.where('counsellingData.cetSeatNumber', '>=', searchCriteria.cetSeatNumber);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getFormSteps() {
        const snapshot = await this.counsellingForms.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async editFormSteps(formData) {
        try {
            await this.counsellingForms.doc(formData.id).set(formData, { merge: true });
            return { message: 'Form steps updated successfully' };
        } catch (error) {
            throw new Error('Form steps update failed');
        }
    }

    async getLists() {
        const snapshot = await this.lists.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async editLists(listsData) {
        try {
            const batch = this.db.batch();
            Object.entries(listsData).forEach(([id, data]) => {
                const docRef = this.lists.doc(id);
                batch.set(docRef, data, { merge: true });
            });
            await batch.commit();
            return { message: 'Lists updated successfully' };
        } catch (error) {
            throw new Error('Lists update failed');
        }
    }

    async deleteLists(listIds) {
        try {
            const batch = this.db.batch();
            listIds.forEach(id => {
                const docRef = this.lists.doc(id);
                batch.delete(docRef);
            });
            await batch.commit();
            return { message: 'Lists deleted successfully' };
        } catch (error) {
            throw new Error('Lists deletion failed');
        }
    }

    async getList(listId) {
        const listDoc = await this.lists.doc(listId).get();
        if (!listDoc.exists) throw new Error('List not found');
        return { id: listDoc.id, ...listDoc.data() };
    }

    async editList(listId, listData) {
        try {
            await this.lists.doc(listId).update(listData);
            return { message: 'List updated successfully' };
        } catch (error) {
            throw new Error('List update failed');
        }
    }

    async deleteList(listId) {
        try {
            await this.lists.doc(listId).delete();
            return { message: 'List deleted successfully' };
        } catch (error) {
            throw new Error('List deletion failed');
        }
    }
}

export default AdminService;
