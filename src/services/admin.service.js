import { db } from "../../config/firebase.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../config/redisClient.js';
import pkg from "firebase-admin";
const { firestore } = pkg;
import path from 'path';
import { sendOneSignalNotification, sendToAllSubscribers } from '../util/sendPushNotification.js';
import fs from 'fs';
import ExcelJS from 'exceljs';

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
        this.appointments = db.collection('appointments');
        this.COLLEGES_FILE_PATH = path.join(process.cwd(), 'src/data/College_New_Data_2.json');
        this.notificationsMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/Notifications.json'), 'utf8'));
        this.list_folders = db.collection('list_folders');
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

   
    async getAllUsers(page = 1, limit = 10, lastDoc = undefined, filters = null) {
    try {
        // Convert parameters to integers
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        
        // Start with base query for counting
        let countQuery = this.users;
        let dataQuery = this.users.orderBy('createdAt', 'desc');
        
        // Apply filters if provided
        if (filters) {
            console.log('Applied filters:', filters);

            
            
            // Premium plan filtering
            if (filters.plan && filters.plan !== 'all') {
                countQuery = countQuery.where('premiumPlan.planTitle', '==', filters.plan);
                dataQuery = dataQuery.where('premiumPlan.planTitle', '==', filters.plan);
            }
            
            // Premium status filtering
            if (filters.isPremium !== undefined) {
                const isPremiumFilter = filters.isPremium === 'true' || filters.isPremium === true;
                countQuery = countQuery.where('isPremium', '==', isPremiumFilter);
                dataQuery = dataQuery.where('isPremium', '==', isPremiumFilter);
            }
            
            // Date range filtering (user creation date)
            if (filters.fromDate) {
                const fromDate = new Date(filters.fromDate);
                fromDate.setHours(0, 0, 0, 0); // Start of day
                const fromTimestamp = firestore.Timestamp.fromDate(fromDate);
                countQuery = countQuery.where('createdAt', '>=', fromTimestamp);
                dataQuery = dataQuery.where('createdAt', '>=', fromTimestamp);
            }
            
            if (filters.toDate) {
                const toDate = new Date(filters.toDate);
                toDate.setHours(23, 59, 59, 999); // End of day
                const toTimestamp = firestore.Timestamp.fromDate(toDate);
                countQuery = countQuery.where('createdAt', '<=', toTimestamp);
                dataQuery = dataQuery.where('createdAt', '<=', toTimestamp);
            }
            
            // Phone number filtering
            if (filters.phone) {
                const phoneFilter = filters.phone.startsWith('+') ? filters.phone : `+91${filters.phone}`;
                countQuery = countQuery.where('phone', '==', phoneFilter);
                dataQuery = dataQuery.where('phone', '==', phoneFilter);
            }
            
            // Name filtering (partial match using >= and <= with unicode suffix)
            if (filters.name) {
                countQuery = countQuery.where('name', '>=', filters.name)
                                      .where('name', '<=', filters.name + '\uf8ff');
                dataQuery = dataQuery.where('name', '>=', filters.name)
                                    .where('name', '<=', filters.name + '\uf8ff');
            }
            
            // Email filtering
            if (filters.email) {
                countQuery = countQuery.where('email', '>=', filters.email.toLowerCase())
                                      .where('email', '<=', filters.email.toLowerCase() + '\uf8ff');
                dataQuery = dataQuery.where('email', '>=', filters.email.toLowerCase())
                                    .where('email', '<=', filters.email.toLowerCase() + '\uf8ff');
            }
        }
        
        // Get total count of matching documents
        const totalCountSnapshot = await this.users.count().get();
        const totalUsers = totalCountSnapshot.data().count;
        
        // Get count of filtered documents
        let filteredCountSnapshot;
        try {
            filteredCountSnapshot = await countQuery.count().get();
        } catch (error) {
            // If count query fails due to composite index requirements, we'll calculate it later
            console.warn('Count query failed, will calculate from results:', error.message);
            filteredCountSnapshot = null;
        }
        
        // If lastDoc is provided, use cursor-based pagination
        if (lastDoc) {
            // Get a reference to the last document
            const lastDocRef = await this.users.doc(lastDoc).get();
            
            if (!lastDocRef.exists) {
                console.warn(`Last document with ID ${lastDoc} not found, ignoring cursor`);
            } else {
                // Start after the last document (cursor-based pagination)
                dataQuery = dataQuery.startAfter(lastDocRef);
            }
        }
        
        // Get one extra document to determine if there are more pages
        const snapshot = await dataQuery.limit(limitNum + 1).get();
        
        // Determine if there are more pages
        const hasMore = snapshot.docs.length > limitNum;
        
        // Remove the extra document from the results if it exists
        let users = snapshot.docs
            .slice(0, limitNum)
            .map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Additional client-side filtering for complex conditions that Firestore can't handle
        if (filters) {
            // List assignment filtering (client-side since it's array-based)
            if (filters.listAssigned !== undefined) {
                const hasListsFilter = filters.listAssigned === 'true' || filters.listAssigned === true;
                if (hasListsFilter) {
                    users = users.filter(user => user.lists && user.lists.length > 0);
                } else {
                    users = users.filter(user => !user.lists || user.lists.length === 0);
                }
            }
            
            // Form completion filtering (client-side)
            if (filters.formCompleted !== undefined) {
                const formCompletedFilter = filters.formCompleted === 'true' || filters.formCompleted === true;
                if (formCompletedFilter) {
                    users = users.filter(user => user.stepsData && user.stepsData.length > 0);
                } else {
                    users = users.filter(user => !user.stepsData || user.stepsData.length === 0);
                }
            }
            
            // City filtering (client-side for partial matches)
            if (filters.city) {
                users = users.filter(user => 
                    user.city && user.city.toLowerCase().includes(filters.city.toLowerCase())
                );
            }
            
            // State filtering (client-side for partial matches)
            if (filters.state) {
                users = users.filter(user => 
                    user.state && user.state.toLowerCase().includes(filters.state.toLowerCase())
                );
            }
            
            // Payment status filtering (client-side)
            if (filters.paymentPending !== undefined) {
                const paymentPendingFilter = filters.paymentPending === 'true' || filters.paymentPending === true;
                users = users.filter(user => 
                    user.isPremium && 
                    user.premiumPlan && 
                    !!user.premiumPlan.isPaymentPending === paymentPendingFilter
                );
            }
        }
        
        // Calculate filtered count if we couldn't get it from Firestore
        const filteredCount = filteredCountSnapshot ? 
            filteredCountSnapshot.data().count : 
            users.length; // This is approximate for the current page
        
        console.log(`Total users: ${totalUsers}, Filtered count: ${filteredCount}, Page results: ${users.length}`);
        
        return {
            users,
            hasMore,
            totalUsers,
            filteredCount,
            currentPage: pageNum,
            pageSize: limitNum,
            lastDoc: users.length > 0 ? users[users.length - 1].id : null,
            appliedFilters: filters || {}
        };
            } catch (error) {
                console.error('Error fetching users with pagination:', error);
                throw new Error(`Failed to fetch users: ${error.message}`);
            }
        }


  async getAllUsersOfForm(formId, userIds = []) {
    let usersStepData = [];
    try {
        // Use Promise.all with map to wait for all asynchronous operations to complete
        const userPromises = userIds.map(async (userId) => {
            const userRef = this.users.doc(userId);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.stepsData && userData.stepsData.id === formId) {
                    console.log(userData.stepsData);
                    return { id: userDoc.id,name:userDoc.name, stepsData: userData.stepsData };
                }
            }
            return null; // Return null for users that don't match the criteria
        });

        // Wait for all promises to resolve
        const results = await Promise.all(userPromises);

        // Filter out null values (users that didn't match the criteria)
        usersStepData = results.filter(data => data !== null);

        return usersStepData;
    } catch (err) {
        console.error('Error fetching users of form:', err);
        return [];
    }
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
            await this.invalidateCache(`user:*`);
            
            
            
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
                        purchasedDate: firestore.Timestamp.fromDate(new Date(data.premiumPlan.purchasedDate)),
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

    async resetUsersStepData() {
        try {
            const userRef =await  this.users.where('isPremium',"==",true).get();
            const forms = await this.counsellingForms.get();
            const fetchedForms = [];
            if(forms.empty) throw new Error('No forms found');
            forms.forEach((form) => {
                fetchedForms.push({
                    id: form.id,
                    ...form.data()
                });
            })

            if(fetchedForms.length === 0) throw new Error('No forms found');
            if (userRef.empty) throw new Error('No users found');

            const dataToPrint = []

            userRef.docs.forEach(async (userDoc) => {
                const userId = userDoc.id;
                const userData = userDoc.data();

                let updatedData = userData.stepsData || null;

                if(!updatedData){
                    const form = userData.premiumPlan?.form
                    if(!form) {
                        return
                    }
                    const formData = fetchedForms.find(form => form.id === userData.premiumPlan.form);
                    updatedData = {
                        id: formData.id,
                        steps: formData.steps.map(step => ({
                            ...step,
                            collegeName: "",
                            branchCode: "",
                            verdict: ""
                        })),
                    }

                    
                }

                const formsData = fetchedForms.find(form => form.id === userData.premiumPlan.form);

                if (!formsData) throw new Error(`Form not found for user ${userId}`);

                updatedData.id = formsData.id;
                updatedData.steps = formsData.steps.map(step => ({
                    ...step,
                    collegeName: "",
                    branchCode: "",
                    verdict: ""
                }))

                if (userData.isPremium){
                        await this.users.doc(userId).update({
                            stepsData: updatedData,
                        })
                        console.log(`Updated user ${userId} with step data:`, updatedData);
                        
                        dataToPrint.push({
                            id: userId,
                            name: userData.name,
                            phone: userData.phone,
                            stepsData: updatedData
                        });
                        
                }



            })
            await this.invalidateCache('users:*');
            return { message: `Users stepdata reset successfully`,  data: dataToPrint.slice(0, 10) };
        } catch (error) {
            console.log(error);
            
            throw new Error('User update failed');
        }
    }
    async addEmailToCounselling() {
        try {
            const userRef =await  this.users.get();
           
    
            if (userRef.empty) throw new Error('No users found');

            const dataToPrint = []
            

            userRef.docs.forEach(async (userDoc) => {
                const userId = userDoc.id;
                const userData = userDoc.data();

                if (userData.email){
                        await this.users.doc(userId).update({
                            counsellingData:{
                                ...userData.counsellingData,
                                email: userData.email
                            }
                        })
                        
                        dataToPrint.push({
                            id: userId,
                            name: userData.name,
                            phone: userData.phone,
                            counsellingData:{
                                ...userData.counsellingData,
                                email: userData.email
                            }
                        });
                        
                }
            })
            await this.invalidateCache('users:*');
            return { message: `Users stepdata reset successfully`,  data: dataToPrint.slice(0, 10) };
        } catch (error) {
            console.log(error);
            
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
                const oldFolderId = data.folderId || null;
                batch.set(docRef, {
                    ...data,
                    lastUpdatedBy: admin.email,
                    updatedAt: timestamp
                }, { merge: true });

                if (data.folderId && oldFolderId !== data.folderId) {
                    const folderRef = this.list_folders.doc(data.folderId);
                    batch.update(folderRef, {
                        list_count: firestore.FieldValue.increment(1)
                    });
                    if (oldFolderId) {
                        const oldFolderRef = this.list_folders.doc(oldFolderId);
                        batch.update(oldFolderRef, {
                            list_count: firestore.FieldValue.increment(-1)
                        });
                    }
                }
            });
            
            await batch.commit();
            await this.invalidateCache('lists:*');
            return { message: 'Lists updated successfully' };
        } catch (error) {
            throw new Error('Lists update failed');
        }
    }
    async appendList(listsId,colleges,admin) {
        try {
            const batch = this.db.batch();
            const timestamp = new Date().toISOString();
            
            
                const docRef = this.lists.doc(listsId);
                batch.set(docRef, {
                    colleges,
                    lastUpdatedBy: admin.email,
                    updatedAt: timestamp
                }, { merge: true });

            // Update the list folder's list_count
            const listDoc = await docRef.get();
            if (!listDoc.exists) throw new Error('List not found');
            
            
            await batch.commit();
            await this.invalidateCache('lists:*');
            return { message: 'Lists apepended successfully' };
        } catch (error) {
            throw new Error('Lists append failed');
        }
    }

    async deleteLists(listIds) {
        try {
            const batch = this.db.batch();
            listIds.forEach(id => {
                const docRef = this.lists.doc(id);
                const archRef = this.list_folders.doc("archive_1");
                const folderRef = this.list_folders.doc(docRef.get('folderId'));
                const isDeleted = docRef.get('isDeleted') || false;
                if (isDeleted) {
                    console.warn(`List ${id} is archived, deleting permanently.`);
                    batch.delete(docRef);
                    batch.update(archRef, {
                        list_count: firestore.FieldValue.increment(-1),
                    })
                } else {
                    batch.update(docRef, {
                    isDeleted: true,
                    deletedAt: new Date().toISOString(),
                    deleteFolderId: "archive_1"
                    });
                    batch.update(archRef, {
                        list_count: firestore.FieldValue.increment(1),
                    })
                }
                // Move to archive folder
                
                // Optionally, you can also remove the list from the folder's lists array
                
                batch.update(folderRef, {
                    list_count: firestore.FieldValue.increment(-1),
                });
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
            const listDoc = await this.lists.doc(listId).get();
            if (!listDoc.exists) throw new Error('List not found');
            // Check if folderId exists
            if (requestData.folderId) {
                const folderDoc = await this.list_folders.doc(requestData.folderId).get();
                if (!folderDoc.exists) {
                    throw new Error(`Folder with ID ${requestData.folderId} does not exist`);
                }
            }
            const oldFolderId = listDoc.get('folderId') || null;
            // Regular list update
            await this.lists.doc(listId).update({
                ...requestData,
                folderId: requestData.folderId || oldFolderId,
                lastUpdatedBy: admin.email,
                updatedAt: timestamp
            });

            this.invalidateCache('lists:*');
            this.invalidateCache(`list:${listId}`);
            
            return await this.getList(listId);
        } catch (error) {
            console.error('List update error:', error);
            throw new Error('List update failed: ' + error.message);
        }
    }

    async deleteList(listId) {
        try {
            const listDoc = await this.lists.doc(listId).get();
            if (!listDoc.exists) throw new Error('List not found');
            // Move to archive folder
            const archRef = this.list_folders.doc("archive_1");
            const originalFolderId = await listDoc.get('folderId') || null;
            
            const folderRef = originalFolderId ? this.list_folders.doc(originalFolderId): null;
            const isDeleted = listDoc.get('isDeleted') || false;
            if (isDeleted) {
                console.warn(`List ${listId} is already archived, deleting permanently.`);
                await this.lists.doc(listId).delete();
                await archRef.update({
                    list_count: firestore.FieldValue.increment(-1),
                });
                if(folderRef)
                await folderRef.update({
                    list_count: firestore.FieldValue.increment(-1),
                });
                this.invalidateCache('lists:*');
                this.invalidateCache(`list:${listId}`);
                return { message: 'List deleted permanently' };
            }
            console.log(`Deleting list ${listId} and moving to archive folder`);
            
            const batch = this.db.batch();
            batch.update(this.lists.doc(listId), {
                isDeleted: true,
                deletedAt: new Date().toISOString(),
                deleteFolderId: "archive_1"
            });
            // Optionally, you can also remove the list from the folder's lists array
            batch.update(archRef, {
                list_count: firestore.FieldValue.increment(1),
            })
            if(folderRef)
            batch.update(folderRef, {
                list_count: firestore.FieldValue.increment(-1),
            });

            await batch.commit();

            this.invalidateCache('lists:*');
            this.invalidateCache(`list:${listId}`);
            return { message: 'List deleted successfully' };
        } catch (error) {
            console.log(error);
            
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

            // If folderId is provided, ensure it exists
            if (data.folderId) {
                const folderDoc = await this.list_folders.doc(data.folderId).get();
                if (!folderDoc.exists) {
                    throw new Error(`Folder with ID ${data.folderId} does not exist`);
                }
                // Increment the list count for the folder
                const folderRef = this.list_folders.doc(data.folderId);
                await folderRef.update({
                    list_count: firestore.FieldValue.increment(1)
                });
            } else {
                // If no folderId is provided, default to "default" folder
                data.folderId = null;
            }
            
            const docRef = await this.lists.add(data);
            this.invalidateCache('lists:*');
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
            console.log(listData.colleges[0]);
            
            
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

            await this.invalidateCache(`user:*`);
            await this.invalidateCache(`userlists:*/user/${userId}/lists`);
            await this.invalidateCache(`users:*`);
            
            
            
            return userLists[listIndex];
        } catch (error) {
            console.error('Update user list error:', error);
            throw new Error('Failed to update user list: ' + error.message);
        }
    }
    async updateCreatedUserList(userId, listId, listData, admin) {
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
            const userLists = userData.createdList || [];
            
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
             await this.invalidateCache(`user:*`);
            await this.invalidateCache(`userlists:*/user/${userId}/lists`);
            await this.invalidateCache(`users:*`);
            
            await this.users.doc(userId).update({
                createdList: userLists
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
            const userLists = userData.createdList || [];

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
                createdList: [...userLists, newAssignment]
            });
            
            // Send notification to user
            // await this.sendNotification(userId, 'LIST_ASSIGNED', {
            //     listId: listAssignment.originalListId,
            //     listName: listAssignment.name || 'New List'
            // });
            
            this.invalidateCache('user:*')
            this.invalidateCache('user_lists')
            return { message: `List assigned to user ${userData.id} (${userData.phone}) successfully` };
        } catch (error) {
            throw new Error(`Failed to assign list: ${error.message}`);
        }
    }

    async releaseListToUser(userId, listId) {
        try {
            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();
            const userCreatedLists = userData.createdList || [];
            const userAssignedLists = userData.lists || [];

            // Check if list is already assigned
            

            const createdListAssignment = userCreatedLists.find(list => {
                return list.id === listId || list.listId === listId || list.originalListId === listId;
            })



            const isListAssigned = userAssignedLists.some(list => 
                createdListAssignment && (list.originalListId === createdListAssignment.originalListId || 
                list.listId === createdListAssignment.originalListId
            ));
            
            if (isListAssigned) {
                throw new Error('List is already assigned to this user');
            }

            // Add new list to user's lists array
            // Keep the full list data structure as provided
            const newAssignment = {
                ...createdListAssignment,
                listId: createdListAssignment.originalListId // Maintain backward compatibility
            };

            const newCreatedList = userCreatedLists.filter(list => {
                return !(list.id === listId || list.listId === listId || list.originalListId === listId);
            })

            await this.users.doc(userId).update({
                lists: [...userAssignedLists, newAssignment],
                createdList: newCreatedList
            });
            
            // Send notification to user
            await this.sendNotification(userId, 'LIST_ASSIGNED', {
                listId: createdListAssignment.originalListId,
                listName: createdListAssignment.name || 'New List'
            });
            this.invalidateCache('user:*')
            this.invalidateCache('user_lists')
            return { message: `List assigned to user ${userData.id} (${userData.phone}) successfully` };
        } catch (error) {
            throw new Error(`Failed to assign list: ${error.message}`);
        }
    }
    async releaseAllListToUser(userId) {
        try {
            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();
            const userCreatedLists = userData.createdList || [];
            const userAssignedLists = userData.lists || [];

            // Check if list is already assigned
            

            const createdListAssignment = userCreatedLists.find(list => { 
                return list.id === listId || list.listId === listId || list.originalListId === listId;
            })

            const newLists = []

            userCreatedLists.forEach((createdList)=>{
                    const isListAssigned = userAssignedLists.some(list => 
                        createdListAssignment && (list.originalListId === createdList.originalListId || 
                        list.listId === createdList.originalListId
                    ));

                    if(!isListAssigned){
                        const newAssignment = {
                            ...createdList,
                            listId: createdList.originalListId // Maintain backward compatibility
                        };

                        newLists.push(newAssignment);
                    }
            })



            const isListAssigned = userAssignedLists.some(list => 
                createdListAssignment && (list.originalListId === createdListAssignment.originalListId || 
                list.listId === createdListAssignment.originalListId
            ));
            
            if (isListAssigned) {
                throw new Error('List is already assigned to this user');
            }
            
            await this.users.doc(userId).update({
                lists: [...userAssignedLists, ...newLists],
                createdList: []
            });
            
            // Send notification to user
            await this.sendNotification(userId, 'LIST_ASSIGNED', {
                listId: 'Some Id',
                listName: 'New List'
            });
            this.invalidateCache('user:*')
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
            
            this.invalidateCache(`userlists:*/user/${userId}/lists`);
            this.invalidateCache(`user:*/user/${userId}`);
            this.invalidateCache(`user:*`);
          

            return { 
                message: 'List removed successfully',
                remainingLists: userLists
            };
        } catch (error) {
            console.error('Delete user list error:', error);
            throw new Error('Failed to delete user list: ' + error.message);
        }
    }
    async deleteUserCreatedList(userId, listId) {
        try {
            const userDoc = await this.users.doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();
            const userLists = userData.createdList || [];
            console.log(listId);
            

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
            createdList: userLists
            });

               this.invalidateCache(`userlists:*/user/${userId}/lists`);
            this.invalidateCache(`user:*/user/${userId}`);
            this.invalidateCache(`user:*`);
            
          

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

    async exportAllUsersToExcel(filters = null) {
    try {
        let users = [];
        let lastDoc = null;
        const batchSize = 1000;

        // Paginate Firestore query to get all premium users
        while (true) {
            let query = this.users
                .orderBy('createdAt', 'desc')
                .where('isPremium', '==', false)
                .limit(batchSize);

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            if (snapshot.empty) {
                break;
            }

            const batchUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            users = users.concat(batchUsers);
            lastDoc = snapshot.docs[snapshot.docs.length - 1];

            if (snapshot.size < batchSize) {
                break;
            }
        }

        // Prepare data for Excel
        const userData = users.map((user, index) => ({
            'S.No': index + 1,
            'Name': user.name || 'N/A',
            'Phone': user.phone || 'N/A',
            'Email': user.email || 'N/A',
        }));

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');

        // Add headers
        const headers = ['S.No', 'Name', 'Phone', 'Email'];
        worksheet.addRow(headers);

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Add data rows
        userData.forEach(user => {
            const row = worksheet.addRow([
                user['S.No'],
                user['Name'],
                user['Phone'],
                user['Email']
            ]);
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Create exports directory if needed
        const exportsDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        // Generate file name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `users_export_${timestamp}.xlsx`;
        const filepath = path.join(exportsDir, filename);

        // Write file
        await workbook.xlsx.writeFile(filepath);

        console.log(`Exported ${userData.length} users to Excel file: ${filename}`);

        return {
            message: `Successfully exported ${userData.length} users to Excel`,
            filename,
            filepath,
            totalUsers: userData.length,
            exportedData: userData.slice(0, 5),
            appliedFilters: filters || {}
        };

    } catch (error) {
        console.error('Error exporting users to Excel:', error);
        throw new Error(`Failed to export users to Excel: ${error.message}`);
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


     async sendNotificationToUsers(userIds,title, message, toAll = false, filters = null) {
        try {
            // Get user to retrieve OneSignal playerId
            if (toAll) {
                const allUsers = await this.users.get();
                console.log(`Sending notification to: `, allUsers.docs.length, " users");
                allUsers.forEach(async (userDoc) => {
                    const userData = userDoc.data();
                    const oneSignalId = userData.oneSignalId;
                    console.log(oneSignalId);
                    
                    
                    // Skip if no OneSignal ID is associated with the user
                    if (!oneSignalId) {
                        // console.log(`No OneSignal ID found for user ${userDoc.id}, skipping notification`);
                        return null;
                    }
                    
                    
                    
                    // Merge default additional data with custom data
                    const additionalData = {
                        userId: userDoc.id
                    };
                    
                    // Send notification using the utility
                    return await sendOneSignalNotification(
                        oneSignalId,
                        title,
                        message,
                        additionalData
                    );
                });
                return {success: true, message: `Notification sent to all users`};
            }

            if(filters){
                let userOneSignalIds = [];
                let query = this.users.orderBy("createdAt", "desc");
                if(filters.isPremium){
                    query = query.where('isPremium', '==', true);
                }
                if(filters.isFree){
                    query = query.where('isPremium', '==', false);
                }


                if(filters.plan && filters.plan !== 'all' && filters.plan.length > 0) {
                    query = query.where('premiumPlan.planTitle', '==', filters.plan);
                }

                if(filters.listAssigned){
                    query = query.where('lists', '!=', null);
                }

                if(filters.listsNotAssigned){
                    query = query.where('lists', '==', null);
                }

                userOneSignalIds = await query.get().then(snapshot => {
                    if (snapshot.empty) {
                        console.log('No users found with the applied filters');
                        return [];
                    }
                    
                    return snapshot.docs.map(doc => {
                        const userData = doc.data();
                        const oneSignalId = userData.oneSignalId;
                        
                        // Skip if no OneSignal ID is associated with the user
                        if (!oneSignalId) {
                            console.log(`No OneSignal ID found for user ${doc.id}, skipping notification`);
                            return null;
                        }
                        
                        return oneSignalId
                    }).filter(user => user !== null);
                })

                console.log(`Sending notification to: `, userOneSignalIds.length, " users");
                await sendToAllSubscribers(userOneSignalIds, title, message, {});

                return {success: true, message: `Notification sent to filtered users`};
            }   


            // userIds.forEach(async (userId) => {
            //     const userDoc = await this.users.doc(userId).get();
            //     if (!userDoc.exists) {
            //         return null;
            //     }
            
            //     const userData = userDoc.data();
            //     const oneSignalId = userData.oneSignalId;
            
            //     // Skip if no OneSignal ID is associated with the user
            //     if (!oneSignalId) {
            //         console.log(`No OneSignal ID found for user ${userId}, skipping notification`);
            //         return null;
            //     }
                
                
            
            //     // Merge default additional data with custom data
            //     const additionalData = {
            //         userId: userId
            //     };
            
            //     // Send notification using the utility
            //     return await sendOneSignalNotification(
            //         oneSignalId,
            //         title,
            //         message,
            //         additionalData
            //     );
            //     })
        } catch (error) {
            console.error('Send group notification error:', error);
            // We don't want notification errors to break the main functionality
            // So we log the error but don't throw it
            return null;
        }
    }

    async findUserByOrderId(orderId) {
        try {
        // First, try to find by orderIds array
        let query = this.users.where('orderIds', 'array-contains', orderId);
        let usersSnapshot = await query.get();
        
        if (!usersSnapshot.empty) {
            return usersSnapshot;
        }
        
        // If not found, try currentOrderId
        query = this.users.where('currentOrderId', '==', orderId);
        usersSnapshot = await query.get();
        
        return usersSnapshot;
        
    } catch (error) {
        console.error('Find user with order error:', error);
        throw new Error('Failed to find user with order: ' + error.message);
    }
}

async updateUserWithOrderId(orderId, planData, orderData) {
        try {
            const userSnapshot = await this.findUserByOrderId(orderId);
            if (userSnapshot.empty) {
                console.log('No user found with the provided order ID');
                return {sucess: false, message: 'No user found with the provided order ID'};
            }
            
            const userDoc = userSnapshot.docs[0];
            const userId = userDoc.id;
            const userData = userDoc.data();
            const orders = userData.orders || [];
            const existingOrder = orders.find(order => order.id === orderId);
            const updatedOrders = orders.map(order =>
                order.id === orderId ? { ...order, ...orderData, paymentStatus: orderData.status == "paid" ? "completed":orderData.status } : order
            );
            // Update user's premium plan and order details
            if(orderData.status === "paid")
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

    async getAppointments(filters = null) {
        try {
            let query = this.appointments.orderBy("createdAt", "desc");
            // Apply filters if provided
            if (filters) {
                // Date range filtering
                if (filters.fromDate) {
                    const fromDate = new Date(filters.fromDate);
                    fromDate.setHours(0, 0, 0, 0); // Start of day
                    const fromTimestamp = firestore.Timestamp.fromDate(fromDate);
                    query = query.where('createdAt', '>=', fromTimestamp);
                }
                
                if (filters.toDate) {
                    const toDate = new Date(filters.toDate);
                    toDate.setHours(23, 59, 59, 999); // End of day
                    const toTimestamp = firestore.Timestamp.fromDate(toDate);
                    query = query.where('createdAt', '<=', toTimestamp);
                }
                
                // Filter by status if provided
                if (filters.status) {
                    query = query.where('status', '==', filters.status);
                }
                if(filters.phone){
                    query = query.where('phone', '==', filters.phone);
                }
            }

                const snapshot = await query.get();
                if (snapshot.empty) {
                    return [];
                }
                  const appointments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            return appointments;
        } catch (error) {
            console.error('Get appointments error:', error);
            throw new Error('Failed to get appointments: ' + error.message);
        }
    }

    async editAppointment(appointmentId, appointmentData) {
        try {
            const appointmentDoc = await this.appointments.doc(appointmentId).get();
            if (!appointmentDoc.exists) throw new Error('Appointment not found');

            const timestamp = new Date().toISOString();
            await this.appointments.doc(appointmentId).update({
                ...appointmentData,
                updatedAt: timestamp
            });

            return { 
                message: 'Appointment updated successfully',
                appointment: {
                    id: appointmentId,
                    ...appointmentData
                }
            };
        } catch (error) {
            throw new Error(`Failed to update appointment: ${error.message}`);
        }
    }

    async getTracking() {
        try {
            // Get all users
            const userSnapshot = await this.users.get();
            const users = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get today's date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];
            
            // Calculate metrics
            const totalInstalls = users.length;
           return {
                totalUsers: totalInstalls,
               
            };
        } catch (error) {
            console.error('Get tracking error:', error);
            throw new Error('Failed to get tracking data: ' + error.message);
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
                    purchasedDate: user.premiumPlan?.purchasedDate?.toDate() || 'N/A'
                })).sort((a, b) => {
                    if (!a.purchasedDate || !b.purchasedDate) return 0; // Handle cases where purchasedDate is missing
                    return b.purchasedDate - a.purchasedDate; // Sort by purchased date
                })

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
            })).sort((a, b) => {
                if (!a.purchasedDate || !b.purchasedDate) return 0; // Handle cases where purchasedDate is missing
                return b.purchasedDate - a.purchasedDate; // Sort by purchased date
            })

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

             //User with list sorted by premium plans
            const userListDistributionWithLists = {};
            const userListDistributionWithoutLists = {};
            const userListDistributionWithCreatedLists = {};
            const userListDistributionWithoutCreatedLists = {};
            users.filter(user => user.isPremium)
            .map(user => {
                const planTitle = user.premiumPlan?.planTitle || 'N/A';
                if (!userListDistributionWithLists[planTitle]) {
                    userListDistributionWithLists[planTitle] = [];
                }
                if(!userListDistributionWithoutLists[planTitle]) {
                    userListDistributionWithoutLists[planTitle] = [];
                    }
                if (!userListDistributionWithCreatedLists[planTitle]) {
                    userListDistributionWithCreatedLists[planTitle] = [];
                }
                if(!userListDistributionWithoutCreatedLists[planTitle]) {
                    userListDistributionWithoutCreatedLists[planTitle] = [];
                }
                if(user.lists && user.lists.length > 0)
                    userListDistributionWithLists[planTitle].push({
                        id: user.id,
                        name: user.name,
                        phone: user.phone,
                        email: user.email,
                        lists: user.lists.map(list => list.title)
                    });
                else 
                    userListDistributionWithoutLists[planTitle].push({
                        id: user.id,
                        name: user.name,
                        phone: user.phone,
                        email: user.email,
                        lists: []
                    });
                if(user.createdList && user.createdList.length > 0)
                    userListDistributionWithCreatedLists[planTitle].push({
                        id: user.id,
                        name: user.name,
                        phone: user.phone,
                        email: user.email,
                        lists: user.createdList.map(list => list.title)
                    });
                else 
                    userListDistributionWithoutCreatedLists[planTitle].push({
                        id: user.id,
                        name: user.name,
                        phone: user.phone,
                        email: user.email,
                        lists: []
                    });
            })
             const formStepsAnalysis = {};
            const forms = await this.counsellingForms.get();

            forms.forEach(form => {
                console.log(`Analyzing form: ${form.id}`);
                
                 formStepsAnalysis[form.id] = {
                    formTitle: form.id,
                    totalUsers: 0,
                    steps: {}
                }
            })

                forms.forEach(form => {
                const formData = form.data();
                 const formId = form.id;
               
                formData.steps.forEach(step => {
                    formStepsAnalysis[formId].steps[step.number] = {
                        title: step.title,
                    
                        completedCount: 0,
                        rejectedCount: 0,
                    };
                });

                 users.forEach(user => {
                    if(!user.isPremium) return;
                    if (!user.stepsData || !user.stepsData.id) {    
                       
                        return
                    }
                     if(user.stepsData.id !== formId) return;
                    
                    formStepsAnalysis[formId].totalUsers++;
                    
                    user.stepsData.steps.forEach(step => {
                        if (step.number in formStepsAnalysis[formId].steps) {
                            const stepData = formStepsAnalysis[formId].steps[step.number];
                            stepData.totalUsers++;
                            
                            if (step.status === 'Yes') {
                                stepData.completedCount++;
                            } else if (step.status === 'No') {
                                stepData.rejectedCount++;
                            }
                        }
                    });
                }
                );
                
            }
            );
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
                usersWithoutLists,
                formStepsAnalysis,
                listData:{
                userListDistributionWithLists,
                userListDistributionWithoutLists,
                userListDistributionWithCreatedLists,
                userListDistributionWithoutCreatedLists,
                
                }
            };
        } catch (error) {
            console.error('Get analytics error:', error);
            throw new Error('Failed to get analytics data: ' + error.message);
        }
    }

    async bulkUpdate() {
        try {
            const query = this.users.where('isPremium', '==', true).get();
            // Perform the bulk update
            query.then(snapshot => {
                if (snapshot.empty) {
                    console.log('No users found with the specified plan title');
                    return;
                }
                
                const batch = firestore().batch();
                snapshot.docs.forEach(doc => {
                    const userRef = this.users.doc(doc.id);
                    const userData = doc.data();
                    if(userData.email && (!userData.counsellingData || !userData.counsellingData.email)) {
                        batch.update(userRef, {
                            'counsellingData.email': userData.email,
                        })
                    }
                });
                
                return batch.commit();
            }).then(() => {
                console.log('Bulk update completed successfully');
            }).catch(error => {
                console.error('Error during bulk update:', error);
            });
            console.log(`Bulk update query: `, query);
            
            
        } catch (error) {
            console.error('Get analytics error:', error);
            throw new Error('Failed to get analytics data: ' + error.message);
        }
    }



// Get all list folders
async getListFolders() {
    try {
        const snapshot = await this.list_folders.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get list folders error:', error);
        throw new Error('Failed to get list folders: ' + error.message);
    }
}

// Get a single list folder
async getListFolder(folderId) {
    try {
        const folderDoc = await this.list_folders.doc(folderId).get();
        if (!folderDoc.exists) {
            throw new Error('List folder not found');
        }
        return {
            id: folderDoc.id,
            ...folderDoc.data()
        };
    } catch (error) {
        console.error('Get list folder error:', error);
        throw new Error('Failed to get list folder: ' + error.message);
    }
}

// Create a new list folder
async createListFolder(folderData, admin) {
    try {
        const timestamp = new Date().toISOString();
        const data = {
            name: folderData.name,
            isArchive: folderData.isArchive || false,
            list_count: folderData.list_count || 0,
            createdBy: admin.email,
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        const docRef = await this.list_folders.add(data);
        return {
            id: docRef.id,
            ...data
        };
    } catch (error) {
        console.error('Create list folder error:', error);
        throw new Error('Failed to create list folder: ' + error.message);
    }
}

// Update a list folder
async updateListFolder(folderId, folderData, admin) {
    try {
        const folderDoc = await this.list_folders.doc(folderId).get();
        if (!folderDoc.exists) {
            throw new Error('List folder not found');
        }
        
        const timestamp = new Date().toISOString();
        const data = {
            ...folderData,
            updatedAt: timestamp
        };
        
        await this.list_folders.doc(folderId).update(data);
        return {
            id: folderId,
            ...folderDoc.data(),
            ...data
        };
    } catch (error) {
        console.error('Update list folder error:', error);
        throw new Error('Failed to update list folder: ' + error.message);
    }
}

// Delete a list folder
async deleteListFolder(folderId) {
    try {
        const folderDoc = await this.list_folders.doc(folderId).get();
        if (!folderDoc.exists) {
            throw new Error('List folder not found');
        }

        const lists = this.lists.where('folderId', '==', folderId);
        const listsSnapshot = await lists.get();
       // delete all lists in the folder
        if (!listsSnapshot.empty) {
            const batch = firestore().batch();
            listsSnapshot.docs.forEach(doc => {
                batch.update(this.lists.doc(doc.id), {
                    isDeleted: true,
                    deletedAt: new Date().toISOString(),
                    deleteFolderId: "archive_1" // Move to archive folder
                })
            });   
            await batch.commit();
        }
        // Delete the folder
        await this.list_folders.doc(folderId).delete();
        this.invalidateCache('list_folders:*');
        return {
            message: 'List folder deleted successfully'
        };
    } catch (error) {
        console.error('Delete list folder error:', error);
        throw new Error('Failed to delete list folder: ' + error.message);
    }
}

// Archive/unarchive a list folder
async archiveListFolder(folderId, isArchive, admin) {
    try {
        const folderDoc = await this.list_folders.doc(folderId).get();
        if (!folderDoc.exists) {
            throw new Error('List folder not found');
        }
        
        const timestamp = new Date().toISOString();
        await this.list_folders.doc(folderId).update({
            isArchive: isArchive,
            updatedAt: timestamp
        });
        
        return {
            id: folderId,
            isArchive: isArchive,
            message: `List folder ${isArchive ? 'archived' : 'unarchived'} successfully`
        };
    } catch (error) {
        console.error('Archive list folder error:', error);
        throw new Error('Failed to archive list folder: ' + error.message);
    }
}


// Restore a deleted list
async restoreList(listId) {
    try {
        const listDoc = await this.lists.doc(listId).get();
        if (!listDoc.exists) throw new Error('List not found');
        
        const listData = listDoc.data();
        if (!listData.isDeleted) throw new Error('List is not marked as deleted');
        
        // Get the original folder ID
        const originalFolderId = listData.folderId || 'default';
        const archiveFolderId = "archive_1";
        
        const batch = this.db.batch();
        batch.update(this.lists.doc(listId), {
            isDeleted: false,
            deletedAt: null,
            deleteFolderId: null
        });
        
        // Update folder list counts
        const archiveRef = this.list_folders.doc(archiveFolderId);
        const folderRef = this.list_folders.doc(originalFolderId);
        
        batch.update(archiveRef, {
            list_count: firestore.FieldValue.increment(-1),
        });
        console.log(`Updating folder ${originalFolderId} list count`);
        const folderData = await folderRef.get();
        if (folderData.exists) {
            batch.update(folderRef, {
            list_count: firestore.FieldValue.increment(1),
            });
        }else{
            console.warn(`Folder ${originalFolderId} does not exist, skipping list count update`);
            batch.update(this.lists.doc(listId), {
                folderId: null // Move to archive folder if original folder does not exist
            });
        }
        
        
        
        
        
        await batch.commit();
        
        this.invalidateCache('lists:*');
        this.invalidateCache(`list:${listId}`);
        
        return { 
            message: 'List restored successfully',
            listId: listId,
            folderId: originalFolderId
        };
    } catch (error) {
        console.error('Restore list error:', error);
        throw new Error('List restoration failed: ' + error.message);
    }
}

// Copy list to another folder
async copyListToFolder(listId, targetFolderId, admin) {
    try {
        // Verify list exists
        const listDoc = await this.lists.doc(listId).get();
        if (!listDoc.exists) throw new Error('List not found');
        
        // Verify target folder exists
        const folderDoc = await this.list_folders.doc(targetFolderId).get();
        if (!folderDoc.exists) throw new Error('Target folder not found');
        
        // Get the list data
        const listData = listDoc.data();
        
        // Create a new list with the same data but a new ID
        const timestamp = new Date().toISOString();
        const newListData = {
            ...listData,
            folderId: targetFolderId,
            title: `${listData.title} (Copy)`, // Append (Copy) to title
            createdAt: timestamp,
            updatedAt: timestamp,
            lastUpdatedBy: admin.email,
            createdBy: admin.email,
            isDeleted: false,
            deletedAt: null,
            deleteFolderId: null
        };
        
        // Add the new list
        const newListRef = await this.lists.add(newListData);
        
        // Update target folder list count
        await this.list_folders.doc(targetFolderId).update({
            list_count: firestore.FieldValue.increment(1)
        });
        
        this.invalidateCache('lists:*');
        
        return { 
            message: 'List copied successfully',
            newListId: newListRef.id,
            targetFolderId: targetFolderId,
            newList: {
                id: newListRef.id,
                ...newListData
            }
        };
    } catch (error) {
        console.error('Copy list error:', error);
        throw new Error('Failed to copy list: ' + error.message);
    }
}
async moveListToFolder(listId, targetFolderId, admin) {
    try {
        // Verify list exists
        const listDoc = await this.lists.doc(listId).get();
        if (!listDoc.exists) throw new Error('List not found');

        const originalFolderId = listDoc.data().folderId || 'default';
        
        // Verify target folder exists
        const originalFolderDoc = await this.list_folders.doc(originalFolderId).get();
       
        if (originalFolderId === targetFolderId) {
            console.log('List is already in the target folder, no action taken');  
        }else{
        const targetFolderDoc = await this.list_folders.doc(targetFolderId).get();
             if (!targetFolderDoc.exists) throw new Error('Target folder not found');
             const batch = this.db.batch();
        // Move the list to the new folder
        batch.update(this.lists.doc(listId), {
            folderId: targetFolderId,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: admin.email
        });
        // Update original folder list count
        if(originalFolderDoc.exists)
        batch.update(this.list_folders.doc(originalFolderId), {
            list_count: firestore.FieldValue.increment(-1)
        });
        // Update target folder list count
        batch.update(this.list_folders.doc(targetFolderId), {
            list_count: firestore.FieldValue.increment(1)
        });
        // Commit the batch
        await batch.commit();
        }
       
       
       
        
        this.invalidateCache('lists:*');
        this.invalidateCache(`list:${listId}`);
        this.invalidateCache(`list_folders:*`);
        
        return { 
            message: 'List moved successfully',
            
        };
    } catch (error) {
        console.error('Copy list error:', error);
        throw new Error('Failed to copy list: ' + error.message);
    }
}

async exportPremiumUsersCounsellingData() {
    try {
        console.log('Starting export of premium users counselling data to Excel');
        let premiumUsers = [];
        let lastDoc = null;
        const batchSize = 1000;

        // Paginate Firestore query to get all premium users
        while (true) {
            let query = this.users
                .orderBy('createdAt', 'desc')
                .where('isPremium', '==', true)
                .limit(batchSize);

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            if (snapshot.empty) {
                break;
            }

            const batchUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            premiumUsers = premiumUsers.concat(batchUsers);
            lastDoc = snapshot.docs[snapshot.docs.length - 1];

            if (snapshot.size < batchSize) {
                break;
            }
        }

        console.log(`Found ${premiumUsers.length} premium users`);

        // Prepare data for Excel
        const userData = premiumUsers.map((user, index) => {
            // Format dates if they exist
            let purchasedDate = 'N/A';
            if (user.premiumPlan?.purchasedDate) {
                if (user.premiumPlan.purchasedDate._seconds) {
                    purchasedDate = new Date(user.premiumPlan.purchasedDate._seconds * 1000).toLocaleDateString();
                } else if (user.premiumPlan.purchasedDate.toDate) {
                    purchasedDate = user.premiumPlan.purchasedDate.toDate().toLocaleDateString();
                }
            }
            
            let expiryDate = 'N/A';
            if (user.premiumPlan?.expiryDate) {
                if (user.premiumPlan.expiryDate._seconds) {
                    expiryDate = new Date(user.premiumPlan.expiryDate._seconds * 1000).toLocaleDateString();
                } else if (user.premiumPlan.expiryDate.toDate) {
                    expiryDate = user.premiumPlan.expiryDate.toDate().toLocaleDateString();
                }
            }

            return {
                'S.No': index + 1,
                'Name': user.name || 'N/A',
                'Phone': user.phone || 'N/A',
                'Email': user.email || 'N/A',
                
                // Plan details
                'CET Marks': user.counsellingData?.cetMarks || 'N/A',
                'JEE Marks': user.counsellingData?.jeeMarks || 'N/A',
                'CET Percentile': user.counsellingData?.cetPercentile || 'N/A',
                'JEE Percentile': user.counsellingData?.jeePercentile || 'N/A',

               
                // Personal counselling data
                'Full Name': user.counsellingData?.fullName || user.name || 'N/A',
                'City': user.counsellingData?.city || 'N/A',
                'Category': user.counsellingData?.category || 'N/A',
                'Defense': user.counsellingData?.isDefense || 'N/A',
                'PWD': user.counsellingData?.isPwd || 'N/A',
                
                // Academic details
                'Board Marks': user.counsellingData?.boardMarks || 'N/A',
                'Board Type': user.counsellingData?.boardType || 'N/A',
                'CET Seat Number': user.counsellingData?.cetSeatNumber || 'N/A',
                
                'JEE Seat Number': user.counsellingData?.jeeSeatNumber || 'N/A',
               
                
                // Preferences
                'Preferred Locations': user.counsellingData?.preferredLocations || 'N/A',
                'Budget': user.counsellingData?.budget || 'N/A',
                
                // Payment details
                'Plan Title': user.premiumPlan?.planTitle || 'N/A',
                'Purchase Date': purchasedDate,
                'Expiry Date': expiryDate,
                'Form Type': user.premiumPlan?.form || 'N/A',
                
            };
        });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Premium Users Counselling');

        // Add headers
        const headers = Object.keys(userData[0] || {});
        worksheet.addRow(headers);

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Add data rows
        userData.forEach(user => {
            const rowValues = Object.values(user);
            const row = worksheet.addRow(rowValues);
            
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 12 ? 12 : maxLength + 2;
        });

        // Freeze the header row
        worksheet.views = [
            { state: 'frozen', ySplit: 1 }
        ];

        // Add color bands for easier reading
        for (let i = 2; i <= worksheet.rowCount; i++) {
            if (i % 2 === 0) {
                worksheet.getRow(i).eachCell(cell => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF5F5F5' }
                    };
                });
            }
        }

        // Create exports directory if needed
        const exportsDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        // Generate file name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `premium_users_counselling_data_${timestamp}.xlsx`;
        const filepath = path.join(exportsDir, filename);

        // Write file
        await workbook.xlsx.writeFile(filepath);

        console.log(`Exported ${userData.length} premium users to Excel file: ${filename}`);

        return {
            message: `Successfully exported ${userData.length} premium users counselling data`,
            filename,
            filepath,
            totalUsers: userData.length,
            exportedData: userData.slice(0, 5) // Preview of first 5 records
        };
    } catch (error) {
        console.error('Error exporting premium users counselling data to Excel:', error);
        throw new Error(`Failed to export premium users data: ${error.message}`);
    }
}


}

// new AdminService().bulkUpdate();

export default AdminService;
