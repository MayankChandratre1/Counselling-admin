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
        this.colleges = db.collection('colleges_v2');
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

    async editList(listId, requestData) {
        try {
            const timestamp = new Date().toISOString();
            
            // If assigning to user
            if (requestData.userId && requestData.listData) {
                const userDoc = await this.users.doc(requestData.userId).get();
                if (!userDoc.exists) {
                    throw new Error('User not found');
                }

                const userData = userDoc.data();
                const userLists = userData.lists || [];

                // Create a unique ID for the user's copy of the list
                const userListId = `${listId}_${userData.id}_${timestamp}`;

                // Create a copy of the list for this user
                const userList = {
                    id: userListId,
                    originalListId: listId,
                    title: requestData.listData.title,
                    colleges: requestData.listData.colleges,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    customized: false
                };

                // Add to user's lists array
                await this.users.doc(requestData.userId).update({
                    lists: [...userLists, userList]
                });

                return userList;
            }
            
            // Regular list update
            await this.lists.doc(listId).update({
                ...requestData,
                updatedAt: timestamp
            });
            
            return await this.getList(listId);
        } catch (error) {
            console.error('List update error:', error);
            throw new Error('List update failed: ' + error.message);
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

    async addList(listData) {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                ...listData,
                colleges: listData.colleges || [],
                createdAt: timestamp,
                updatedAt: timestamp
            };
            
            const docRef = await this.lists.add(data);
            return { id: docRef.id, ...data };
        } catch (error) {
            throw new Error('Failed to add list');
        }
    }

    async searchColleges(searchQuery) {
        try {
            let query = this.colleges;
            
            // Check if we need to fetch all cities for the city filter
            if (searchQuery.fetchAllCities) {
                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            
            // Check if we need to fetch all branches for the branch filter
            if (searchQuery.fetchAllBranches) {
                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            
            const snapshot = await query.get();
            let results = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter results for instituteName
            if (searchQuery.instituteName) {
                const searchTerm = searchQuery.instituteName.toLowerCase();
                results = results.filter(college => 
                    college.instituteName.toLowerCase().includes(searchTerm)
                );
            }

            // Filter results for instituteCode
            if (searchQuery.instituteCode) {
                const codeSearch = searchQuery.instituteCode.toString();
                results = results.filter(college => 
                    college.instituteCode.toString().includes(codeSearch)
                );
            }
            
            // Filter by city if specified
            if (searchQuery.city) {
                results = results.filter(college => 
                    college.city && college.city === searchQuery.city
                );
            }
            
            // Filter by branch if specified
            if (searchQuery.branch) {
                results = results.filter(college => 
                    college.branches && 
                    college.branches.some(branch => 
                        branch.branchName.toLowerCase().includes(searchQuery.branch.toLowerCase())
                    )
                );
            }

            return results.slice(0, 10); // Limit to 10 results
        } catch (error) {
            throw new Error('Failed to search colleges');
        }
    }

    async getUserLists(userId) {
        try {
            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }
            const userData = userDoc.data();
            
            // Return user's lists array if it exists, or empty array if not
            return userData.lists || [];
        } catch (error) {
            console.error('Get user lists error:', error);
            throw new Error('Failed to get user lists: ' + error.message);
        }
    }

    async updateUserList(userId, listId, listData) {
        try {
            console.log(`Updating user list. UserID: ${userId}, ListID: ${listId}`);
            
            if (!listId) {
                throw new Error('List ID is required');
            }
            
            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();
            const userLists = userData.lists || [];
            
            // Find the list by any of its potential ID fields
            const listIndex = userLists.findIndex(l => {
                console.log(`Comparing list IDs: list.id=${l.id}, list.listId=${l.listId}, list.originalListId=${l.originalListId}, targetId=${listId}`);
                return (l.id && l.id === listId) || 
                       (l.listId && l.listId === listId) || 
                       (l.originalListId && l.originalListId === listId);
            });
            
            console.log(`Found list at index: ${listIndex}`);

            if (listIndex === -1) {
                throw new Error(`List not found in user's lists. Searched for ID: ${listId}`);
            }

            // Update the specific list in user's lists array
            const timestamp = new Date().toISOString();
            const originalList = userLists[listIndex];
            
            console.log('Original list:', originalList);
            
            userLists[listIndex] = {
                ...originalList,
                ...listData,
                id: originalList.id || listId,
                listId: originalList.listId || originalList.id || listId, // Ensure listId is preserved
                originalListId: originalList.originalListId || originalList.listId || originalList.id || listId,
                updatedAt: timestamp,
                isCustomized: true,
                customized: true
            };

            console.log('Updated list data:', userLists[listIndex]);
            
            await this.users.doc(userId).update({
                lists: userLists
            });

            return userLists[listIndex];
        } catch (error) {
            console.error('Update user list error:', error);
            throw new Error('Failed to update user list: ' + error.message);
        }
    }

    async assignListToUser(userId, listAssignment) {
        try {
            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();
            const userLists = userData.lists || [];

            // Check if list is already assigned
            const isListAssigned = userLists.some(list => 
                list.originalListId === listAssignment.originalListId || 
                list.listId === listAssignment.originalListId
            );
            
            if (isListAssigned) {
                throw new Error('List is already assigned to this user');
            }

            // Add new list to user's lists array
            // Keep the full list data structure as provided
            const newAssignment = {
                ...listAssignment,
                listId: listAssignment.originalListId // Maintain backward compatibility
            };

            await this.users.doc(userId).update({
                lists: [...userLists, newAssignment]
            });

            return { message: 'List assigned successfully', assignedList: newAssignment };
        } catch (error) {
            throw new Error(`Failed to assign list: ${error.message}`);
        }
    }

    async deleteUserList(userId, listId) {
        try {
            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();
            const userLists = userData.lists || [];

            // Find list by either id or listId (for backward compatibility)
            const listIndex = userLists.findIndex(list => 
                list.id === listId || list.listId === listId
            );

            if (listIndex === -1) {
                throw new Error('List not found');
            }

            // Remove the list
            userLists.splice(listIndex, 1);

            // Update user document
            await this.users.doc(userId).update({
                lists: userLists
            });

            return { 
                message: 'List removed successfully',
                remainingLists: userLists
            };
        } catch (error) {
            console.error('Delete user list error:', error);
            throw new Error('Failed to delete user list: ' + error.message);
        }
    }
}

export default AdminService;
