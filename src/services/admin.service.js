import { db } from "../../config/firebase.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../config/redisClient.js';
import pkg from "firebase-admin";
const { firestore } = pkg;
import path from 'path';
import { sendOneSignalNotification } from '../util/sendPushNotification.js';
import fs from 'fs';

class AdminService {
    constructor(){
        this.db = db;
        this.users = db.collection('users');
        this.admins = db.collection('admins');
        this.admin_activities = db.collection('admin_activities');
        this.permissions = db.collection('permissions');
        this.counsellingForms = db.collection('counsellingForms');
        this.lists = db.collection('lists');
        this.colleges = db.collection('colleges_v4');
        this.registrationForm = db.collection('registrationForm');
        this.notes = db.collection('notes');
        this.landingPage = db.collection('landingPage');
        this.dynamicScreens = db.collection('dynamicScreens');
        this.payments = db.collection('paymentLogs');
        this.COLLEGES_FILE_PATH = path.join(process.cwd(), 'src/data/College_New_Data_2.json');
        this.notificationsMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/Notifications.json'), 'utf8'));
    }

    async invalidateCache(pattern) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(keys);
        }
    }

     async getAll(page = 1, limit = 10, lastDoc = undefined) {
            try {
               
                
                // Create base query with ordering to ensure consistent pagination
                let query = this.users.orderBy('createdAt', 'desc');
                
                // If lastDoc is provided, use cursor-based pagination
               
                
                // Get the total count for information purposes
                const totalCountSnapshot = await this.users.count().get();
                const totalUsers = totalCountSnapshot.data().count;
                
                // Get one extra document to determine if there are more pages
                const snapshot = await query.get();
                
                // Determine if there are more pages
                const hasMore = snapshot.docs.length > limit;
                
                // Remove the extra document from the results if it exists
                const users = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }));
                
                fs.writeFileSync(
                    path.join(process.cwd(), 'src/data/users.json'),
                    JSON.stringify(users, null, 2)
                );
                
                return {
                    users,
                    hasMore,
                    totalUsers,
                };
            } catch (error) {
                console.error('Error fetching users with pagination:', error);
                throw new Error(`Failed to fetch users: ${error.message}`);
            }
    }   

    async getUserByPhone(phone) {
        const snapshot = await this.users.where('phone', '==', phone).get();
        if (snapshot.empty) return null;
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

   
    async getAllUsers(page = 1, limit = 10, lastDoc = undefined) {
            try {
                // Convert parameters to integers
                const pageNum = parseInt(page, 10);
                const limitNum = parseInt(limit, 10);
                
                // Create base query with ordering to ensure consistent pagination
                let query = this.users.orderBy('createdAt', 'desc');
                
                // If lastDoc is provided, use cursor-based pagination
                if (lastDoc) {
                    // Get a reference to the last document
                    const lastDocRef = await this.users.doc(lastDoc).get();
                    
                    if (!lastDocRef.exists) {
                        console.warn(`Last document with ID ${lastDoc} not found, ignoring cursor`);
                    } else {
                        // Start after the last document (cursor-based pagination)
                        query = query.startAfter(lastDocRef);
                    }
                }
                
                // Get the total count for information purposes
                const totalCountSnapshot = await this.users.count().get();
                const totalUsers = totalCountSnapshot.data().count;
                
                // Get one extra document to determine if there are more pages
                const snapshot = await query.limit(limitNum + 1).get();
                
                // Determine if there are more pages
                const hasMore = snapshot.docs.length > limitNum;
                
                // Remove the extra document from the results if it exists
                const users = snapshot.docs
                    .slice(0, limitNum)
                    .map(doc => ({ id: doc.id, ...doc.data() }));
                
                return {
                    users,
                    hasMore,
                    totalUsers,
                    currentPage: pageNum,
                    pageSize: limitNum,
                    lastDoc: users.length > 0 ? users[users.length - 1].id : null
                };
            } catch (error) {
                console.error('Error fetching users with pagination:', error);
                throw new Error(`Failed to fetch users: ${error.message}`);
            }
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
            
            let data = {
                ...userData,
            }
            if(userData.isPremium){
                
                data = {
                    ...data,
                    premiumPlan:{
                        ...data.premiumPlan,
                        purchasedDate: firestore.Timestamp.fromDate(new Date(data.premiumPlan.purchasedDate)),
                        expiryDate: firestore.Timestamp.fromDate(new Date(data.premiumPlan.expiryDate))
                    }
                }
            }
            

            await this.users.doc(userId).update(data);
            await this.invalidateCache('users:*');
            await this.invalidateCache(`user:*/user/${userId}`);
            
            
            
            return { message: `User ${userId} updated successfully` };
        } catch (error) {
            console.log(error);
            
            throw new Error('User update failed');
        }
    }
    async addUser(userData) {
        try {

            let data = {
                ...userData,
                createdAt: firestore.Timestamp.fromDate(new Date()),
            }
            if(userData.isPremium){
                data = {
                    ...data,
                    premiumPlan:{
                        ...data.premiumPlan,
                        purchasedDate: firestore.Timestamp.fromDate(new Date(data.premiumPlan.purchaseDate)),
                        expiryDate: firestore.Timestamp.fromDate(new Date(data.premiumPlan.expiryDate))
                    }
                }
            }
            await this.users.add(userData);
            await this.invalidateCache('users:*');
            
            
            
            return { message: `User added successfully` };
        } catch (error) {
            console.log(error);
            
            throw new Error('User add failed');
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
            
            // Send notification to user
            await this.sendNotification(userId, 'LIST_ASSIGNED', {
                listId: listAssignment.originalListId,
                listName: listAssignment.name || 'New List'
            });
            this.invalidateCache('user')
            this.invalidateCache('user_lists')
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
        const fallback = {
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
                steps: steps ?? fallback.steps,
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
            // Import fs module for file operations
            const fs = await import('fs/promises');
            const path = await import('path');
            
            let collegeIds = query.collegeIds || [];
            if(collegeIds.length > 0) {
                collegeIds = collegeIds.map(id => id.toString().split('_')[0]);
            }
            
            // Read college data from file instead of Firestore
            const fileData = await fs.readFile(this.COLLEGES_FILE_PATH, 'utf8');
            const allColleges = JSON.parse(fileData);
            
            // Filter colleges by requested IDs
            const formattedData = collegeIds.map(collegeId => {
                // Find the college in the JSON data
                const college = allColleges.find(c => 
                    c.id === collegeId || c.id.toString() === collegeId
                );
                
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
                message: note === '' ? 'Note deleted successfully' : 'Note added successfully',
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

    async editLandingPage(landingPageData) {
        try {
            const timestamp = new Date().toISOString();
            await this.landingPage.doc('landingPage').set({
                ...landingPageData,
                updatedAt: timestamp
            }, { merge: true });
            
            await this.invalidateCache('landingpage:*');
            
            return { 
                message: 'Landing page updated successfully',
                landingPageData,
                updatedAt: timestamp
            };
        } catch (error) {
            console.error('Edit Landing Page error:', error);
            throw new Error('Failed to edit landing page: ' + error.message);
        }
    }

    async getLandingPage(){
        try {
            const landingPageDoc = await this.landingPage.doc('landingPage').get();
            if (!landingPageDoc.exists) {
                throw new Error('Landing page not found');
            }
            return landingPageDoc.data();
        } catch (error) {
            console.error('Get Landing Page error:', error);
            throw new Error('Failed to get landing page: ' + error.message);
        }
    }



    async updateHomePage(homePageData) {
        try {
            const timestamp = new Date().toISOString();
            await this.landingPage.doc('homepage').set({
                ...homePageData,
                updatedAt: timestamp
            }, { merge: true });
            
            await this.invalidateCache('homepage:*');
                
                // Send notification to each user
                this.sendNotification(null, 'HOME_UPDATE', {
                    message: 'The home page has been updated. Check it out!'
                }, true);
           
            
            return { 
                message: 'Home page updated successfully',
                homePageData,
                updatedAt: timestamp
            };
        } catch (error) {
            console.error('Update Home Page error:', error);
            throw new Error('Failed to update home page: ' + error.message);
        }
    }

    async getHomePage() {
        try {
            const homePageDoc = await this.landingPage.doc('homepage').get();
            if (!homePageDoc.exists) {
                throw new Error('Home page not found');
            }
            return homePageDoc.data();
        } catch (error) {
            console.error('Get Home Page error:', error);
            throw new Error('Failed to get home page: ' + error.message);
        }
    }

    async updatePremiumPlans(premiumPlansData) {
        try {
            const timestamp = new Date().toISOString();
            await this.landingPage.doc('premiumPlans').set({
                ...premiumPlansData,
                updatedAt: timestamp
            }, { merge: true });
            
            await this.invalidateCache('premiumplans:*');
            
            return { 
                message: 'Premium plans updated successfully',
                premiumPlansData,
                updatedAt: timestamp
            };
        } catch (error) {
            console.error('Update Premium Plans error:', error);
            throw new Error('Failed to update premium plans: ' + error.message);
        }
    }

    async getPremiumPlans() {
        try {
            const premiumPlansDoc = await this.landingPage.doc('premiumPlans').get();
            if (!premiumPlansDoc.exists) {
                return {}; // Return empty object if premium plans not found
            }
            return premiumPlansDoc.data();
        } catch (error) {
            console.error('Get Premium Plans error:', error);
            throw new Error('Failed to get premium plans: ' + error.message);
        }
    }

    async updateContactData(contactData) {
        try {
            const timestamp = new Date().toISOString();
            await this.landingPage.doc('contact').set({
                ...contactData,
                updatedAt: timestamp
            }, { merge: true });
            
            await this.invalidateCache('contact:*');
            
            return { 
                message: 'Contact data updated successfully',
                contactData,
                updatedAt: timestamp
            };
        } catch (error) {
            console.error('Update Contact Data error:', error);
            throw new Error('Failed to update contact data: ' + error.message);
        }
    }

    async getContactData() {
        try {
            const contactDataDoc = await this.landingPage.doc('contact').get();
            if (!contactDataDoc.exists) {
                return {}; // Return empty object if contact data not found
            }
            return contactDataDoc.data();
        } catch (error) {
            console.error('Get Contact Data error:', error);
            throw new Error('Failed to get contact data: ' + error.message);
        }
    }

    async updateDynamicPages(dynamicPagesData) {
        try {
            const timestamp = new Date().toISOString();
            await this.dynamicScreens.doc('screens').set({
                ...dynamicPagesData,
                updatedAt: timestamp
            }, { merge: true });
            
            await this.invalidateCache('dynamic:*');
            
            return { 
                message: 'Dynamic pages updated successfully',
                dynamicPagesData,
                updatedAt: timestamp
            };
        } catch (error) {
            console.error('Update Dynamic Pages error:', error);
            throw new Error('Failed to update dynamic pages: ' + error.message);
        }
    }

    async getDynamicPages() {
        try {
            const dynamicPagesDoc = await this.dynamicScreens.doc('screens').get();
            if (!dynamicPagesDoc.exists) {
                return {}; // Return empty object if dynamic pages not found
            }
            return dynamicPagesDoc.data();
        } catch (error) {
            console.error('Get Dynamic Pages error:', error);
            throw new Error('Failed to get dynamic pages: ' + error.message);
        }
    }

        async getUserPayment(phone){
        try {
            console.log(`+${phone}`);
            
            const paymentDoc = await this.payments.where('data.contact', '==', `${phone}`).get();
            if (paymentDoc.empty) {
                return []
            }
            const payments = paymentDoc.docs.map(doc => ({id: doc.id,...doc.data()}));
            return payments;
        } catch (error) {
            console.error('Get User Payments error:', error);
            throw new Error('Failed to get user payments: ' + error.message);
        }
    }

    async getPaymentsByOrderId(orderId) {
        try {
            const paymentDoc = await this.payments.where('data.id', '==', orderId).get();
            if (paymentDoc.empty) {
                throw new Error('Payment details not found for this order ID');
            }
            return paymentDoc.docs.map(doc => doc.data());
        } catch (error) {
            console.error('Get Payments by Order ID error:', error);
            throw new Error('Failed to get payments by order ID: ' + error.message);
        }
    }

    async getPaymentsByPaymentId(paymentId) {
        try {
            const paymentDoc = await this.payments.where('data.id', '==', paymentId).get();
            if (paymentDoc.empty) {
                throw new Error('Payment details not found for this payment ID');
            }
            return paymentDoc.docs.map(doc => doc.data());
        } catch (error) {
            console.error('Get Payments by Payment ID error:', error);
            throw new Error('Failed to get payments by payment ID: ' + error.message);
        }
    }

   async getPayments(lastdoc, limit, page, filters = null) {
    try {
        console.log(`Fetching payments with limit: ${limit}, page: ${page} ${lastdoc}`);
        console.log('Applied filters:', filters);
        
        // Start with base query
        let query = this.payments.orderBy('timestamp', 'desc');
        
        // Apply filters if provided
        if (filters) {
            // Date range filtering
            if (filters.fromDate) {
                const fromDate = new Date(filters.fromDate);
                fromDate.setHours(0, 0, 0, 0); // Start of day
                const fromTimestamp = firestore.Timestamp.fromDate(fromDate);
                query = query.where('timestamp', '>=', fromTimestamp);
            }
            
            if (filters.toDate) {
                const toDate = new Date(filters.toDate);
                toDate.setHours(23, 59, 59, 999); // End of day
                const toTimestamp = firestore.Timestamp.fromDate(toDate);
                query = query.where('timestamp', '<=', toTimestamp);
            }
            
            // Plan filtering - filter by customerPlan in notes
            if (filters.plan && filters.plan !== 'all') {
                query = query.where('data.notes.customerPlan', '==', filters.plan);
            }
            
            // Event type filtering
            if (filters.type) {
                if (filters.type === 'order') {
                    // Filter for order events
                    query = query.where('eventType', 'in', ['order.paid', 'order.created']);
                } else if (filters.type === 'payment') {
                    // Filter for payment events
                    query = query.where('eventType', 'in', ['payment.captured', 'payment.failed', 'payment.authorized']);
                }
            }
            
            // Status filtering for orders
            if (filters.status && filters.type === 'order') {
                if (filters.status === 'paid') {
                    query = query.where('eventType', '==', 'order.paid');
                } else {
                    // For other order statuses, filter by data.status
                    query = query.where('data.status', '==', filters.status);
                }
            }
            
            // Status filtering for payments (when type is not 'order')
            if (filters.status && filters.type !== 'order') {
                if (filters.status === 'captured') {
                    query = query.where('eventType', '==', 'payment.captured');
                } else if (filters.status === 'failed') {
                    query = query.where('eventType', '==', 'payment.failed');
                } else if (filters.status === 'authorized') {
                    query = query.where('eventType', '==', 'payment.authorized');
                } else {
                    // Generic status filtering
                    query = query.where('data.status', '==', filters.status);
                }
            }
        }
        
        // Apply pagination
        if (lastdoc) {
            const docRef = this.payments.doc(lastdoc);
            const snapshot = await docRef.get();
            
            if (!snapshot.exists) {
                throw new Error(`Document with ID ${lastdoc} not found`);
            }
            
            console.log(`Starting after document: ${snapshot.id}`);
            query = query.startAfter(snapshot);
        }
        
        // Apply limit
        query = query.limit(parseInt(limit, 10));
        
        const paymentDoc = await query.get();
        
        if (paymentDoc.empty) {
            console.log('No payment details found with applied filters');
            return [];
        }
        
        let results = paymentDoc.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Additional client-side filtering for complex conditions that Firestore can't handle
        if (filters) {
            // Filter by payment method if specified
            if (filters.method) {
                results = results.filter(payment => 
                    payment.data && payment.data.method === filters.method
                );
            }
            
            // Filter by phone number if specified
            if (filters.phone) {
                const phoneFilter = filters.phone.startsWith('+') ? filters.phone : `+91${filters.phone}`;
                results = results.filter(payment => 
                    payment.data && payment.data.contact === phoneFilter
                );
            }
            
            // Filter by email if specified
            if (filters.email) {
                results = results.filter(payment => 
                    payment.data && payment.data.email && 
                    payment.data.email.toLowerCase().includes(filters.email.toLowerCase())
                );
            }
            
            // Filter by amount range if specified
            if (filters.minAmount) {
                results = results.filter(payment => 
                    payment.data && payment.data.amount >= (parseFloat(filters.minAmount) * 100)
                );
            }
            
            if (filters.maxAmount) {
                results = results.filter(payment => 
                    payment.data && payment.data.amount <= (parseFloat(filters.maxAmount) * 100)
                );
            }
        }
        
        console.log(`Filtered results count: ${results.length}`);
        return results;
        
    } catch (error) {
        console.error('Get Payments error:', error);
        throw new Error('Failed to get payments: ' + error.message);
    }
}

    
    async getAnalytics() {
        try {
            // Get all users
            const userSnapshot = await this.users.get();
            const users = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get today's date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];
            
            // Calculate metrics
            const totalInstalls = users.length;
            const enrolledUsers = {
                total: users.filter(user => user.isPremium).length,
                users: users.filter(user => user.isPremium).map(user => ({
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    planTitle: user.premiumPlan?.planTitle || 'N/A',
                    purchasedDate: user.premiumPlan?.purchasedDate || 'N/A'
                }))
            }
            
            const todayEnrolled = {
                total: users.filter(user => {
                if (!user.premiumPlan?.purchasedDate) return false;
                
                // Handle different date formats
                let purchaseDate;
                if (user.premiumPlan.purchasedDate._seconds) {
                    // Firestore Timestamp
                    purchaseDate = new Date(user.premiumPlan.purchasedDate._seconds * 1000);
                } else if (user.premiumPlan.purchasedDate.toDate) {
                    // Firestore Timestamp object with toDate method
                    purchaseDate = user.premiumPlan.purchasedDate.toDate();
                } else if (user.premiumPlan.purchasedDate instanceof Date) {
                    // JavaScript Date object
                    purchaseDate = user.premiumPlan.purchasedDate;
                } else {
                    // String or timestamp
                    purchaseDate = new Date(user.premiumPlan.purchasedDate);
                }
                
                const purchaseDateStr = purchaseDate.toISOString().split('T')[0];
                return purchaseDateStr === today;
            }).length,
            users: users.filter(user => {
                if (!user.premiumPlan?.purchasedDate) return false;
                
                // Handle different date formats
                let purchaseDate;
                if (user.premiumPlan.purchasedDate._seconds) {
                    // Firestore Timestamp
                    purchaseDate = new Date(user.premiumPlan.purchasedDate._seconds * 1000);
                } else if (user.premiumPlan.purchasedDate.toDate) {
                    // Firestore Timestamp object with toDate method
                    purchaseDate = user.premiumPlan.purchasedDate.toDate();
                } else if (user.premiumPlan.purchasedDate instanceof Date) {
                    // JavaScript Date object
                    purchaseDate = user.premiumPlan.purchasedDate;
                } else {
                    // String or timestamp
                    purchaseDate = new Date(user.premiumPlan.purchasedDate);
                }
                
                const purchaseDateStr = purchaseDate.toISOString().split('T')[0];
                return purchaseDateStr === today;
            }).map(user => ({
                id: user.id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                planTitle: user.premiumPlan?.planTitle || 'N/A',
                purchasedDate: user.premiumPlan?.purchasedDate?.toDate() || 'N/A'
            }))
            }
            
            const paymentPendingUsers = {
                total: users.filter(user => user.isPremium && user.premiumPlan.isPaymentPending).length,
                users: users.filter(user => user.isPremium && user.premiumPlan.isPaymentPending).map(user => ({
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    amountRemaining: user.premiumPlan.amountRemaining || 'N/A',
                }))
            }
            
            // Get premium plan distribution
            const premiumPlanDistribution = {};
            users.filter(user => user.isPremium && user.premiumPlan?.planTitle)
                .forEach(user => {
                    const planTitle = user.premiumPlan.planTitle;
                    premiumPlanDistribution[planTitle] = (premiumPlanDistribution[planTitle] || 0) + 1;
                });
            
            //User with and without lists
            const usersWithLists = users.filter(user => user.lists && user.lists.length > 0).length;
            const usersWithoutLists = totalInstalls - usersWithLists;
                
            
          
            
            return {
                totalUsers: totalInstalls,
                metrics: {
                    installs: totalInstalls,
                    enrolled: enrolledUsers,
                    todayEnrolled: todayEnrolled,
                    paymentPending: paymentPendingUsers
                },
                premiumPlanDistribution,
                usersWithLists,
                usersWithoutLists
            };
        } catch (error) {
            console.error('Get analytics error:', error);
            throw new Error('Failed to get analytics data: ' + error.message);
        }
    }

    async sendNotification(userId, notificationId, customData = {}, toAll = false) {
        try {
            // Get user to retrieve OneSignal playerId
            if (toAll) {
                const allUsers = await this.users.get();
                allUsers.forEach(async (userDoc) => {
                    const userData = userDoc.data();
                    const oneSignalId = userData.oneSignalId;
                    
                    // Skip if no OneSignal ID is associated with the user
                    if (!oneSignalId) {
                        console.log(`No OneSignal ID found for user ${userDoc.id}, skipping notification`);
                        return null;
                    }
                    
                    // Get notification template from the map
                    const notificationTemplate = this.notificationsMap[notificationId];
                    if (!notificationTemplate) {
                        throw new Error(`Notification template with ID "${notificationId}" not found`);
                    }
                    
                    // Merge default additional data with custom data
                    const additionalData = {
                        ...notificationTemplate.additionalData,
                        ...customData,
                        userId: userDoc.id
                    };
                    
                    // Send notification using the utility
                    return await sendOneSignalNotification(
                        oneSignalId,
                        notificationTemplate.title,
                        notificationTemplate.message,
                        additionalData
                    );
                });
                return null;
            }


            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }
            
            const userData = userDoc.data();
            const oneSignalId = userData.oneSignalId;
            
            // Skip if no OneSignal ID is associated with the user
            if (!oneSignalId) {
                console.log(`No OneSignal ID found for user ${userId}, skipping notification`);
                return null;
            }
            
            // Get notification template from the map
            const notificationTemplate = this.notificationsMap[notificationId];
            if (!notificationTemplate) {
                throw new Error(`Notification template with ID "${notificationId}" not found`);
            }
            
            // Merge default additional data with custom data
            const additionalData = {
                ...notificationTemplate.additionalData,
                ...customData,
                userId: userId
            };
            
            // Send notification using the utility
            return await sendOneSignalNotification(
                oneSignalId,
                notificationTemplate.title,
                notificationTemplate.message,
                additionalData
            );
        } catch (error) {
            console.error('Send notification error:', error);
            // We don't want notification errors to break the main functionality
            // So we log the error but don't throw it
            return null;
        }
    }

    async findUserByOrderId(orderId) {
        try{
           const query = this.users
          .where('currentOrderId', '==', orderId)
        const usersSnapshot = await query.get();
        return usersSnapshot;
        }catch (error) {
            console.error('Find user by order ID error:', error);
            throw new Error('Failed to find user by order ID: ' + error.message);
        }
        
    }

    async updateUserWithOrderId(orderId, planData, orderData) {
        try {
            const userSnapshot = await this.findUserByOrderId(orderId);
            if (userSnapshot.empty) {
                throw new Error('No user found with the provided order ID');
            }
            
            const userDoc = userSnapshot.docs[0];
            const userId = userDoc.id;
            const userData = userDoc.data();
            const orders = userData.orders || [];
            const existingOrder = orders.find(order => order.id === orderId);
            const updatedOrders = orders.map(order =>
                order.id === orderId ? { ...order, ...orderData, paymentStatus: orderData.status == "paid" ? "completed":"pending" } : order
            );
            // Update user's premium plan and order details
            await this.users.doc(userId).update({
                isPremium: true,
                premiumPlan: {
                    ...planData,
                    purchasedDate: new Date(),
                    isPaymentPending: false
                },
                currentOrderId: orderId,
                orders: updatedOrders
            });
            
            return { 
                message: 'User updated with order ID successfully',
                userId,
                planData,
                orderData
            };
        } catch (error) {
            console.error('Update user with order ID error:', error);
            throw new Error('Failed to update user with order ID: ' + error.message);
        }
    }


}

export default AdminService;
