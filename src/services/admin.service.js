import { db } from "../../config/firebase.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../config/redisClient.js';
import pkg from "firebase-admin";
const { firestore } = pkg;
class AdminService {
    constructor(){
        this.db = db;
        this.users = db.collection('users');
        this.admins = db.collection('admins');
        this.admin_activities = db.collection('admin_activities');
        this.permissions = db.collection('permissions');
        this.counsellingForms = db.collection('counsellingForms');
        this.lists = db.collection('lists');
        this.colleges = db.collection('colleges_v3');
        this.registrationForm = db.collection('registrationForm');
        this.notes = db.collection('notes');
    }

    async invalidateCache(pattern) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(keys);
        }
    }

    async login(credentials) {
        const adminRef = await this.admins.where('email', '==', credentials.email).get();
        if (adminRef.empty) throw new Error('Admin not found');
        
        const admin = adminRef.docs[0].data();
        const adminId = adminRef.docs[0].id;
        
        const isPasswordValid = await bcrypt.compare(credentials.password, admin.password);
        if (!isPasswordValid) throw new Error('Invalid password');
        //get permissions
        const permissionsDoc = await this.permissions.doc(admin.role).get();
        if (!permissionsDoc.exists) {
            throw new Error('Permissions for this role do not exist');
        }
        const token = jwt.sign(
            { 
                id: adminId,
                email: admin.email,
                role: admin.role
            }, 
            process.env.JWT_ADMIN_SECRET 
           );

        return { 
            token,
            admin: {
                id: adminId,
                email: admin.email,
                name: admin.name,
                role: admin.role,
                permissions: permissionsDoc.data() || {pages:[]}
            }
        };
    }

    async getAllUsers() {
        const snapshot = await this.users
        .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getAllUsersOfForm(formId) {
        const snapshot = await this.users
        .where('stepsData', '!=', null)
        .where('stepsData.id', '==', formId)
        .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async updateUser(userId, userData) {
        try {
            await this.users.doc(userId).update(userData);
            await this.invalidateCache('users:*');
            await this.invalidateCache(`user:*/user/${userId}`);
            return { message: `User ${userId} updated successfully` };
        } catch (error) {
            throw new Error('User update failed');
        }
    }
    async updateUserStepData(userId, stepsData) {
        try {
            const userRef =  this.users.doc(userId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) throw new Error('User not found');
            const updatedStepsData = stepsData || [];
            const updatedData = {
                stepsData: updatedStepsData,
            }
            await userRef.update(updatedData);
            await this.invalidateCache('users:*');
            await this.invalidateCache(`user:*/user/${userId}`);
            return { message: `User ${userId} stepdata updated successfully` };
        } catch (error) {
            throw new Error('User update failed');
        }
    }

    async deleteUser(userId) {
        try {
            await this.users.doc(userId).delete();
            await this.invalidateCache('users:*');
            await this.invalidateCache(`user:*/user/${userId}`);
            return { message: `User ${userId} deleted successfully` };
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

    async editFormSteps(formData, admin) {
        try {
            await this.counsellingForms.doc(formData.id).set({
                ...formData,
                lastUpdatedBy: admin.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            await this.invalidateCache('formsteps:*');
            return { message: 'Form steps updated successfully' };
        } catch (error) {
            throw new Error('Form steps update failed');
        }
    }

    async getLists() {
        const snapshot = await this.lists.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async editLists(listsData, admin) {
        try {
            const batch = this.db.batch();
            const timestamp = new Date().toISOString();
            
            Object.entries(listsData).forEach(([id, data]) => {
                const docRef = this.lists.doc(id);
                batch.set(docRef, {
                    ...data,
                    lastUpdatedBy: admin.email,
                    updatedAt: timestamp
                }, { merge: true });
            });
            
            await batch.commit();
            await this.invalidateCache('lists:*');
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

    async editList(listId, requestData, admin) {
        try {
            const timestamp = new Date().toISOString();
            
            // Regular list update
            await this.lists.doc(listId).update({
                ...requestData,
                lastUpdatedBy: admin.email,
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

    async addList(listData, admin) {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                ...listData,
                colleges: listData.colleges || [],
                createdAt: timestamp,
                updatedAt: timestamp,
                lastUpdatedBy: admin.email,
                createdBy: admin.email
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

    

    async updateUserList(userId, listId, listData, admin) {
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
            
            
            userLists[listIndex] = {
                ...originalList,
                ...listData,
                id: originalList.id || listId,
                listId: originalList.listId || originalList.id || listId, // Ensure listId is preserved
                originalListId: originalList.originalListId || originalList.listId || originalList.id || listId,
                updatedAt: timestamp,
                lastUpdatedBy: admin.email,
                isCustomized: true,
                customized: true
            };

            console.log('Updated list data:', userLists[listIndex]);
            
            await this.users.doc(userId).update({
                lists: userLists
            });

            await this.invalidateCache(`userlists:*/user/${userId}/lists`);
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

            return { message: `List assigned to user ${userData.id} (${userData.phone}) successfully` };
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

    async getFormConfig() {
        try {
            const formDoc = await this.registrationForm.doc('Form1').get();
            if (!formDoc.exists) {
                // If form doesn't exist, create default structure
                const defaultFormConfig = {
                    steps: [],
                    updatedAt: new Date().toISOString()
                };
                await this.registrationForm.doc('Form1').set(defaultFormConfig);
                return defaultFormConfig;
            }
            const formData = formDoc.data();
            return {
                steps: formData.steps || [],
                updatedAt: formData.updatedAt || new Date().toISOString()
            };
        } catch (error) {
            console.error('Get Form Config error:', error);
            throw new Error('Failed to get form config: ' + error.message);
        }
    }

    async saveFormConfig(steps) {
        const data = {
            "steps": [
              {
                "title": "Basic Information",
                "fields": [
                  {
                    "id": "fullName",
                    "type": "text",
                    "label": "Full Name",
                    "key": "fullName",
                    "required": true,
                    "options": []
                  },
                  {
                    "id": "dob",
                    "type": "date",
                    "label": "Date of Birth",
                    "key": "dob",
                    "required": true,
                    "options": []
                  },
                  {
                    "id": "mobile",
                    "type": "text",
                    "label": "Mobile Number",
                    "key": "mobile",
                    "required": true,
                    "options": [],
                    "editable": false
                  },
                  {
                    "id": "email",
                    "type": "email",
                    "label": "Email",
                    "key": "email",
                    "required": true,
                    "options": []
                  },
                  {
                    "id": "city",
                    "type": "text",
                    "label": "City",
                    "key": "city",
                    "required": true,
                    "options": []
                  },
                  {
                    "id": "state",
                    "type": "text",
                    "label": "State",
                    "key": "state",
                    "required": true,
                    "options": []
                  }
                ]
              },
              {
                "title": "Academic Information",
                "fields": [
                  {
                    "id": "boardMarks",
                    "type": "number",
                    "label": "12th Board Marks",
                    "key": "boardMarks",
                    "required": true,
                    "options": []
                  },
                  {
                    "id": "boardType",
                    "type": "select",
                    "label": "Board Type",
                    "key": "boardType",
                    "required": true,
                    "options": ["State Board", "CBSC", "ICSE"]
                  },
                  {
                    "id": "jeeMarks",
                    "type": "number",
                    "label": "JEE Marks",
                    "key": "jeeMarks",
                    "required": false,
                    "options": []
                  },
                  {
                    "id": "cetMarks",
                    "type": "number",
                    "label": "CET Marks",
                    "key": "cetMarks",
                    "required": false,
                    "options": []
                  },
                  {
                    "id": "preferredField",
                    "type": "select",
                    "label": "Preferred Field",
                    "key": "preferredField",
                    "required": true,
                    "options": ["Computer Science", "Other"]
                  },
                  {
                    "id": "cetSeatNumber",
                    "type": "text",
                    "label": "CET Seat Number",
                    "key": "cetSeatNumber",
                    "required": false,
                    "options": []
                  },
                  {
                    "id": "jeeSeatNumber",
                    "type": "text",
                    "label": "JEE Seat Number",
                    "key": "jeeSeatNumber",
                    "required": false,
                    "options": []
                  }
                ]
              },
              {
                "title": "Preferences and Goals",
                "fields": [
                  {
                    "id": "preferredLocations",
                    "type": "text",
                    "label": "Preferred Locations",
                    "key": "preferredLocations",
                    "required": false,
                    "options": []
                  },
                  {
                    "id": "budget",
                    "type": "select",
                    "label": "Budget",
                    "key": "budget",
                    "required": true,
                    "options": ["Under 1L", "1L - 2L", "Other"]
                  },
                  {
                    "id": "password",
                    "type": "password",
                    "label": "Password",
                    "key": "password",
                    "required": true,
                    "options": []
                  },
                  {
                    "id": "confirmPassword",
                    "type": "password",
                    "label": "Confirm Password",
                    "key": "confirmPassword",
                    "required": true,
                    "options": []
                  },
                  {
                    "id": "termsAccepted",
                    "type": "checkbox",
                    "label": "I agree to the Terms and Conditions",
                    "key": "termsAccepted",
                    "required": true,
                    "options": []
                  }
                ]
              }
            ]
          }
        try {
            const timestamp = new Date().toISOString();
            await this.registrationForm.doc('Form1').set({
                steps: data.steps,
                updatedAt: timestamp
            }, { merge: true });
            
            await this.invalidateCache('formconfig:*');
            
            return { 
                message: 'Form configuration saved successfully',
                steps: steps,
                updatedAt: timestamp
            };
        } catch (error) {
            console.error('Save Form Config error:', error);
            throw new Error('Failed to save form config: ' + error.message);
        }
    }

    async addAdmin(adminData) {
        try {
            // Check if admin with email already exists
            const existingAdmin = await this.admins.where('email', '==', adminData.email).get();
            if (!existingAdmin.empty) {
                throw new Error('Admin with this email already exists');
            }

            if(!adminData.role) {
                adminData.role = 'admin'; // Default role
            }
            if(!adminData.password) {
                adminData.password = 'admin123'; // Default password
            }

            // Hash the password
            adminData.password = await bcrypt.hash(adminData.password, 12);

            //fetch permissions
            const permissionsDoc = await this.permissions.doc(adminData.role).get();
            if (!permissionsDoc.exists) {
                throw new Error('Permissions for this role do not exist');
            }
            const permissionsData = permissionsDoc.data();
            adminData.permissions = permissionsData || {pages:[]};

            // Add timestamp
            const timestamp = new Date().toISOString();
            const data = {
                ...adminData,
                createdAt: timestamp,
                updatedAt: timestamp,
            };

            // Add to admins collection
            const docRef = await this.admins.add(data);
            return {
                message: 'Admin added successfully',
                admin: {
                    id: docRef.id,
                    ...data
                }
            };
        } catch (error) {
            console.error('Add admin error:', error);
            throw new Error(`Failed to add admin: ${error.message}`);
        }
    }

    async getCutoff(query) {
        try {
            const collegeIds = query.collegeIds || [];
            const chunkSize = 30; // Firestore IN query limit
            const results = [];

            // Split collegeIds into chunks of 30
            for (let i = 0; i < collegeIds.length; i += chunkSize) {
                const chunk = collegeIds.slice(i, i + chunkSize);
                const snapshot = await this.colleges
                    .where('id', 'in', chunk)
                    .get();
                
                const chunkData = snapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data() 
                }));
                results.push(...chunkData);
            }

            // Format the data to match original collegeIds order
            const formattedData = collegeIds.map(collegeId => {
                const college = results.find(college => college.id === collegeId);
                return {
                    id: collegeId,
                    branches: college ? college.branches : [] // Return empty array if college not found
                };
            });
            
            return formattedData;
        } catch (error) {
            console.error('Get cutoff error:', error);
            throw new Error('Failed to get cutoff data: ' + error.message);
        }
    }

    async addNote(note, userId, admin) {
        try {
            const noteKey = `note-${admin.email}`;

            if (note === '') {
                // First check if document exists
                const noteDoc = await this.notes.doc(userId).get();
                if (noteDoc.exists) {
                    
                    const noteData = noteDoc.data();
        
                    // Remove the field entirely
                    delete noteData[`${noteKey}`];
                    
                    // Set the entire document with the updated data
                    await this.notes.doc(userId).set(noteData);
                }
                return {
                    message: 'Note deleted successfully',
                    adminEmail: admin.email
                };
            }

            // Add or update note
            await this.notes.doc(userId).set({
                [`${noteKey}`]: {
                    note: note,
                    createdAt: new Date().toISOString()
                },
            }, { merge: true });

            await this.invalidateCache(`notes:*/get-notes/${userId}`);

            return {
                message: 'Note added successfully',
                adminEmail: admin.email
            };
        } catch (error) {
            console.error('save note error:', error);
            throw new Error('Failed to save note: ' + error.message);
        }
    }

    async getNotes(userId) {
        try {
            const noteDoc = await this.notes.doc(userId).get();
            if (!noteDoc.exists) {
                return { message: 'No notes found' };
            }
            return {
                id: noteDoc.id,
                notes: noteDoc.data()
            };
        } catch (error) {
            console.error('save note error:', error);
            throw new Error('Failed to save note: ' + error.message);
        }
    }

    async getAllAdmins() {
        const snapshot = await this.admins.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            password: undefined // Remove password from response
        }));
    }

    async getAdmin(adminId) {
        const adminDoc = await this.admins.doc(adminId).get();
        if (!adminDoc.exists) throw new Error('Admin not found');
        const adminData = adminDoc.data();
        delete adminData.password; // Remove password from response
        return { id: adminDoc.id, ...adminData };
    }
    async getActivityLogs(adminId) {
        
        const activityDoc = await this.admin_activities.doc(adminId).collection('logs').where('method', '!=','GET').orderBy('timestamp','desc').limit(1000).get();
        
        if (activityDoc.empty) throw new Error('No activity logs found for this admin');
        const activities = activityDoc.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return { activities, message: `Fetching activity logs for admin ID: ${adminId}`};
    }

    async updateAdmin(adminId, adminData) {
        try {
            const adminDoc = await this.admins.doc(adminId).get();
            if (!adminDoc.exists) throw new Error('Admin not found');

            if(adminData.role == 'super-admin' && adminData.password) {
                throw new Error('Super-admin password cannot be changed');
            }

            // If password is being updated, hash it
            if (adminData.password) {
                adminData.password = await bcrypt.hash(adminData.password, 12);
            }

            const timestamp = new Date().toISOString();
            await this.admins.doc(adminId).update({
                ...adminData,
                updatedAt: timestamp
            });

            return { 
                message: 'Admin updated successfully',
                admin: {
                    id: adminId,
                    ...adminData,
                    password: undefined
                }
            };
        } catch (error) {
            throw new Error(`Failed to update admin: ${error.message}`);
        }
    }

    async deleteAdmin(adminId) {
        try {
            const adminDoc = await this.admins.doc(adminId).get();
            if (!adminDoc.exists) throw new Error('Admin not found');

            // Prevent deleting super-admin
            const adminData = adminDoc.data();
            if (adminData.role === 'super-admin') {
                throw new Error('Cannot delete super-admin');
            }

            await this.admins.doc(adminId).delete();
            return { message: 'Admin deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete admin: ${error.message}`);
        }
    }

    async getPermissions() {
        try {
            const snapshot = await this.permissions.get();
            return snapshot.docs.map(doc => ({
                role: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            throw new Error('Failed to get permissions');
        }
    }

    async addOrUpdatePermissions(role, permissions) {
        try {
            await this.permissions.doc(role).set(permissions, { merge: true });
            return {
                message: 'Permissions updated successfully',
                role,
                permissions
            };
        } catch (error) {
            throw new Error(`Failed to update permissions: ${error.message}`);
        }
    }

}

export default AdminService;
