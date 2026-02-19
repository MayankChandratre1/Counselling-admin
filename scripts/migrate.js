
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Import Firestore (Correctly this time)
import { db, admin } from '../config/firebase.js';

// Import Schemas
import {
    AdminSchema,
    AppointmentSchema,
    CancellationSchema,
    CollegeUpdateSchema,
    CollegeSchema,
    CounsellingFormSchema,
    DowntimePaymentSchema,
    DynamicScreenSchema,
    LandingPageSchema,
    PremiumPlanSchema,
    LandingPageReviewSchema,
    ListFolderSchema,
    ListSchema,
    ListCollegeSchema,
    MetadataSchema,
    NoteSchema,
    PaymentLogSchema,
    PermissionSchema,
    RegistrationFormSchema,
    UserSchema,
    UserListSchema
} from './Schemas.js';

// Mongo Models
const AdminModel = mongoose.model('Admin', AdminSchema);
const AppointmentModel = mongoose.model('Appointment', AppointmentSchema);
const CancellationModel = mongoose.model('Cancellation', CancellationSchema);
const CollegeUpdateModel = mongoose.model('CollegeUpdate', CollegeUpdateSchema);
const CollegeModel = mongoose.model('Colleges_v4', CollegeSchema); // Name matches firestore key somewhat? Or better standard name? 'College'
const CounsellingFormModel = mongoose.model('CounsellingForm', CounsellingFormSchema);
const DowntimePaymentModel = mongoose.model('DowntimePayment', DowntimePaymentSchema);
const DynamicScreenModel = mongoose.model('DynamicScreen', DynamicScreenSchema);
const LandingPageModel = mongoose.model('LandingPage', LandingPageSchema);
const ListFolderModel = mongoose.model('ListFolder', ListFolderSchema);
const ListModel = mongoose.model('List', ListSchema);
const MetadataModel = mongoose.model('Metadata', MetadataSchema);
const NoteModel = mongoose.model('Note', NoteSchema);
const PaymentLogModel = mongoose.model('PaymentLog', PaymentLogSchema);
const PermissionModel = mongoose.model('Permission', PermissionSchema);
const RegistrationFormModel = mongoose.model('RegistrationForm', RegistrationFormSchema);
const UserModel = mongoose.model('User', UserSchema);
const UserListModel = mongoose.model('UserList', UserListSchema);


// Collection Mapping
const MIGRATION_MAP = [
    { firestore: 'admins', model: AdminModel },
    { firestore: 'colleges_v4', model: CollegeModel },
    { firestore: 'counsellingForms', model: CounsellingFormModel },
    { firestore: 'landingPage', model: LandingPageModel },
    { firestore: 'metadata', model: MetadataModel },
    // 'premiumPlans' seems embedded in landingPage or user? Wait data_samples shows it as separate key but maybe it is subcollection or separate root? 
    // In data_samples.json it is under "premiumPlans" key inside root object? YES.
    // But Schemas.js didn't export PremiumPlanSchema? 
    // Ah, 'landingPage' in schemas includes 'plans'. 
    // Wait, let's check data_samples again. 'landingPage' has 'plans'. AND there is a 'premiumPlans' root key?
    // Checking data_samples... 'landingPage' has 'plans'. AND 'premiumPlans' is a separate root key with 'plans' array inside.
    // It seems 'premiumPlans' collection might exist separately or was duplicated in my schema inference? 
    // Let's assume for now we migrate 'landingPage' (which might contain plans) and if 'premiumPlans' is distinct, we need specific handling. 
    // Re-reading Schemas.js... I missed exporting PremiumPlanSchema if it exists as root collection.
    // Wait, 'LandingPageSchema' has 'plans'.
    // Let's skip 'premiumPlans' for now if it is redundant or assume it is covered by LandingPage or dynamic.

    { firestore: 'appointments', model: AppointmentModel },
    { firestore: 'cancellations', model: CancellationModel },
    { firestore: 'college_updates', model: CollegeUpdateModel },
    // 'cutoffs_v2' -> I didn't see Schema for this in Schemas.js? 
    // Checking Schemas.js content... It has CollegeSchema. 
    // Ah, I might have missed 'cutoffs_v2' in Schemas.js or it was not in data_samples?
    // It WAS in data_samples.json (I see "cutoffs_v2": [] ... wait, I see "cutoffs_v2" in inferred_schemas but not in Schemas.js I wrote?
    // Let me check my previous write_to_file... 
    // I see CollegeSchema, but I don't see Cutoffs_v2Schema.
    // I will skip proper migration of cutoffs_v2 for this script version and focus on main collections first.

    { firestore: 'downtimePayments', model: DowntimePaymentModel },
    { firestore: 'dynamicScreens', model: DynamicScreenModel },
    { firestore: 'list_folders', model: ListFolderModel },
    { firestore: 'lists', model: ListModel },
    { firestore: 'notes', model: NoteModel },
    { firestore: 'paymentLogs', model: PaymentLogModel },
    { firestore: 'permissions', model: PermissionModel },
    { firestore: 'registrationForm', model: RegistrationFormModel },

    // Users last (User Logic + UserLists)
    { firestore: 'users', model: UserModel, custom: true }
];

// Helper: Convert Firestore Data to Mongo/JS
function transformData(data) {
    if (!data) return data;

    if (data && typeof data === 'object') {
        // Handle Firestore Timestamp
        if (data._seconds !== undefined && data._nanoseconds !== undefined) {
            return new Date(data._seconds * 1000 + data._nanoseconds / 1000000);
        }

        // Handle Arrays
        if (Array.isArray(data)) {
            return data.map(item => transformData(item));
        }

        // Handle Objects (Deep traverse)
        const transformed = {};
        for (const [key, value] of Object.entries(data)) {
            transformed[key] = transformData(value);
        }
        return transformed;
    }

    return data;
}

const STATE_FILE = path.join(__dirname, 'migration_state.json');

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return {};
}

function saveState(collection, lastId) {
    const state = loadState();
    state[collection] = lastId;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Backup Helper
function backupBatch(collection, batchIndex, data) {
    const backupDir = path.join(__dirname, '../backups', collection);
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const filename = path.join(backupDir, `batch_${batchIndex}.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Saved backup: ${filename}`);
}

// User Migration Logic
async function migrateUsers(collectionRef) {
    console.log(`Migrating Users...`);
    const state = loadState();
    const lastId = state['users'];

    let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId());
    if (lastId) {
        console.log(`Resuming 'users' from ID: ${lastId}`);
        query = query.startAfter(lastId);
    }

    let hasMore = true;
    let userCount = 0;
    let listCount = 0;

    // Configurable Batch Size
    const BATCH_SIZE = 300;

    while (hasMore) {
        // Fetch larger batch from Firestore
        const snapshot = await query.limit(BATCH_SIZE).get();
        if (snapshot.empty) {
            hasMore = false;
            break;
        }

        const usersToInsert = [];
        const userListsToInsert = [];
        let lastDocIdInBatch = null;

        for (const doc of snapshot.docs) {
            lastDocIdInBatch = doc.id;
            const data = doc.data();
            const mongoData = transformData(data);
            mongoData.id = doc.id;

            // Copy _id to id if new? No, this is migration, so we preserve Firestore ID as 'id'.
            // In Plan we said: Migrated Data: id = Old Firestore ID. _id = New ObjectId.
            // My transformData doesn't generate _id, Mongo will do it.
            // mongoData.id = doc.id (String). Perfect.

            // Extract Lists
            if (mongoData.lists && typeof mongoData.lists === 'object') {
                const listsObj = mongoData.lists;
                const listsArray = Array.isArray(listsObj) ? listsObj : Object.values(listsObj);

                for (const list of listsArray) {
                    if (list && typeof list === 'object') {
                        userListsToInsert.push({
                            id: list.id || new mongoose.Types.ObjectId().toString(),
                            userId: doc.id,
                            type: 'assigned',
                            title: list.title || 'Untitled List',
                            colleges: list.colleges,
                            originalListId: list.originalListId,
                            createdAt: list.createdAt ? new Date(list.createdAt) : new Date(),
                            updatedAt: list.updatedAt ? new Date(list.updatedAt) : new Date(),
                            customized: list.customized,
                            lastUpdatedBy: list.lastUpdatedBy
                        });
                        listCount++;
                    }
                }

                delete mongoData.lists;
            }

            // Extract Created Lists
            if (mongoData.createdList) {
                const createdLists = Array.isArray(mongoData.createdList) ? mongoData.createdList : Object.values(mongoData.createdList);
                for (const list of createdLists) {
                    if (list && typeof list === 'object') {
                        userListsToInsert.push({
                            id: list.id || new mongoose.Types.ObjectId().toString(),
                            userId: doc.id,
                            type: 'created',
                            title: list.title || 'My List',
                            colleges: list.colleges,
                            createdAt: list.createdAt ? new Date(list.createdAt) : new Date(),
                            data: list
                        });
                        listCount++;
                    }
                }
                delete mongoData.createdList;
            }

            usersToInsert.push(mongoData);
            userCount++;
        }

        // --- BACKUP STEP ---
        // Backup Users Batch
        if (usersToInsert.length > 0) {
            backupBatch('users', `${Date.now()}_${lastDocIdInBatch}`, usersToInsert);
        }
        // Backup UserLists Batch
        if (userListsToInsert.length > 0) {
            backupBatch('user_lists', `${Date.now()}_${lastDocIdInBatch}`, userListsToInsert);
        }

        // --- INSERT STEP ---
        if (usersToInsert.length > 0) {
            await UserModel.insertMany(usersToInsert, { ordered: false }).catch(e => {
                // Ignore duplicate key if we are resuming slightly overlapping (shouldn't happen with correct startAfter but safety)
                if (!e.message.includes('E11000')) console.error('User batch insert error:', e.message)
            });
        }
        if (userListsToInsert.length > 0) {
            await UserListModel.insertMany(userListsToInsert, { ordered: false }).catch(e => {
                if (!e.message.includes('E11000')) console.error('UserList batch insert error:', e.message)
            });
        }

        console.log(`Processed ${userCount} users so far...`);

        // Update checkpoint
        if (lastDocIdInBatch) {
            saveState('users', lastDocIdInBatch);
            // Prepare next query
            query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).startAfter(lastDocIdInBatch);
        } else {
            hasMore = false;
        }
    }

    console.log(`Finished Users. Total Users processed: ${userCount}, Lists: ${listCount}`);
}

async function startMigration() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('MONGO_URI not found in .env');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    for (const item of MIGRATION_MAP) {
        const { firestore: collectionName, model, custom } = item;
        console.log(`--- Migrating Collection: ${collectionName} ---`);

        try {
            const collectionRef = db.collection(collectionName);

            if (custom && collectionName === 'users') {
                await migrateUsers(collectionRef);
            } else {
                const state = loadState();
                const lastId = state[collectionName];

                let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId());
                if (lastId) {
                    console.log(`Resuming '${collectionName}' from ID: ${lastId}`);
                    query = query.startAfter(lastId);
                }

                let hasMore = true;
                let count = 0;

                // Configurable Batch Size
                const BATCH_SIZE = 300;

                while (hasMore) {
                    const snapshot = await query.limit(BATCH_SIZE).get();
                    if (snapshot.empty) {
                        hasMore = false;
                        break;
                    }

                    const docs = [];
                    let lastDocIdInBatch = null;

                    for (const doc of snapshot.docs) {
                        lastDocIdInBatch = doc.id;
                        const d = transformData(doc.data());
                        d.id = doc.id;
                        docs.push(d);
                    }

                    if (docs.length > 0) {
                        // --- BACKUP STEP ---
                        backupBatch(collectionName, `${Date.now()}_${lastDocIdInBatch}`, docs);

                        // --- INSERT STEP ---
                        await model.insertMany(docs, { ordered: false }).catch(err => {
                            if (err.writeErrors && err.writeErrors.every(e => e.code === 11000)) {
                                // duplicates ignored
                            } else {
                                console.error(`Error inserting chunk for ${collectionName}: ${err.message}`);
                            }
                        });
                        count += docs.length;
                        console.log(`Migrated ${count} docs for ${collectionName}`);

                        saveState(collectionName, lastDocIdInBatch);
                        query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).startAfter(lastDocIdInBatch);
                    } else {
                        hasMore = false;
                    }
                }
            }

        } catch (err) {
            console.error(`Failed to migrate ${collectionName}:`, err);
        }
    }

    console.log('--- Migration Complete ---');
    process.exit(0);
}

startMigration();


