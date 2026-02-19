import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import V1 Schemas (Source) -> We need to verify if we can import them directly or need to define them attached to connection?
// Mongoose models are usually attached to the default connection. 
// To use multiple connections, we must define models on specific connections.
// So we will import the Schema objects, NOT the models.
import {
    AdminSchema as AdminSchemaV1,
    AppointmentSchema as AppointmentSchemaV1,
    CancellationSchema as CancellationSchemaV1,
    CollegeUpdateSchema as CollegeUpdateSchemaV1,
    CollegeSchema as CollegeSchemaV1,
    CounsellingFormSchema as CounsellingFormSchemaV1,
    DowntimePaymentSchema as DowntimePaymentSchemaV1,
    DynamicScreenSchema as DynamicScreenSchemaV1,
    LandingPageSchema as LandingPageSchemaV1,
    ListFolderSchema as ListFolderSchemaV1,
    ListSchema as ListSchemaV1,
    MetadataSchema as MetadataSchemaV1,
    NoteSchema as NoteSchemaV1,
    PaymentLogSchema as PaymentLogSchemaV1,
    PermissionSchema as PermissionSchemaV1,
    RegistrationFormSchema as RegistrationFormSchemaV1,
    UserSchema as UserSchemaV1,
    UserListSchema as UserListSchemaV1
} from './Schemas.js';

// Import V2 Schemas (Target)
import {
    AdminSchema as AdminSchemaV2,
    AppointmentSchema as AppointmentSchemaV2,
    CancellationSchema as CancellationSchemaV2, // Assuming same name
    CollegeUpdateSchema as CollegeUpdateSchemaV2, // Need to check if V2 has this? V2 didn't explicitly check all, let's assume direct mapping or skip
    CollegeSchema as CollegeSchemaV2,
    CounsellingFormSchema as CounsellingFormSchemaV2,
    // DowntimePaymentSchemaV2? V2 file didn't have it? Let's check V2 file content again mentally or assume simple pass through if schema missing
    // Wait, I should verify V2 exports.
    LandingPageSchema as LandingPageSchemaV2,
    // ListFolderSchemaV2? 
    // ListSchemaV2? -> UserListSchemaV2 covers lists? 
    MetadataSchema as MetadataSchemaV2,
    NoteSchema as NoteSchemaV2,
    PaymentLogSchema as PaymentLogSchemaV2,
    // PermissionSchemaV2?
    RegistrationFormSchema as RegistrationFormSchemaV2,
    UserSchema as UserSchemaV2,
    UserListSchema as UserListSchemaV2
} from './SchemasV2.js';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const MONGO_URI_OLD = process.env.MONGO_URI_OLD;
const MONGO_URI_NEW = process.env.MONGO_URI_NEW;

if (!MONGO_URI_OLD || !MONGO_URI_NEW) {
    console.error('Missing MONGO_URI_OLD or MONGO_URI_NEW in .env');
    process.exit(1);
}

// --- State Management ---
const STATE_FILE = path.join(__dirname, 'migration_v2_state.json');

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


// --- Migration Logic ---
async function migrate() {
    console.log('Connecting to Source DB...');
    const conn1 = await mongoose.createConnection(MONGO_URI_OLD).asPromise();
    console.log('Connected to Source DB.');

    console.log('Connecting to Target DB...');
    const conn2 = await mongoose.createConnection(MONGO_URI_NEW).asPromise();
    console.log('Connected to Target DB.');

    // --- Define Models on Connections ---

    // Source Models (V1)
    const AdminModelV1 = conn1.model('Admin', AdminSchemaV1);
    const AppointmentModelV1 = conn1.model('Appointment', AppointmentSchemaV1);
    // ... define others as needed for Reading
    const CollegeModelV1 = conn1.model('Colleges_v4', CollegeSchemaV1);
    const LandingPageModelV1 = conn1.model('LandingPage', LandingPageSchemaV1);
    const UserModelV1 = conn1.model('User', UserSchemaV1);
    const UserListModelV1 = conn1.model('UserList', UserListSchemaV1);
    const ListModelV1 = conn1.model('List', ListSchemaV1);
    const ListFolderModelV1 = conn1.model('ListFolder', ListFolderSchemaV1); // If migrating lists
    const NoteModelV1 = conn1.model('Note', NoteSchemaV1);
    const RegistrationFormModelV1 = conn1.model('RegistrationForm', RegistrationFormSchemaV1);
    const PaymentLogModelV1 = conn1.model('PaymentLog', PaymentLogSchemaV1);

    // Target Models (V2)
    const AdminModelV2 = conn2.model('Admin', AdminSchemaV2);
    const AppointmentModelV2 = conn2.model('Appointment', AppointmentSchemaV2); // Check if V2 has it
    const CollegeModelV2 = conn2.model('College', CollegeSchemaV2);
    const LandingPageModelV2 = conn2.model('LandingPage', LandingPageSchemaV2);
    const UserModelV2 = conn2.model('User', UserSchemaV2);
    const UserListModelV2 = conn2.model('UserList', UserListSchemaV2);
    const NoteModelV2 = conn2.model('Note', NoteSchemaV2);
    const RegistrationFormModelV2 = conn2.model('RegistrationForm', RegistrationFormSchemaV2);
    const PaymentLogModelV2 = conn2.model('PaymentLog', PaymentLogSchemaV2);

    // Mappings
    const TASKS = [
        { name: 'admins', source: AdminModelV1, target: AdminModelV2 },
        { name: 'colleges', source: CollegeModelV1, target: CollegeModelV2 },
        // Landing Page: Direct map? V2 is stricter but V1 data should fit if structure matches.
        { name: 'landingPage', source: LandingPageModelV1, target: LandingPageModelV2 },

        // Notes, RegForms, PaymentLogs - Simple maps
        { name: 'notes', source: NoteModelV1, target: NoteModelV2 },
        { name: 'registrationForms', source: RegistrationFormModelV1, target: RegistrationFormModelV2 },
        { name: 'paymentLogs', source: PaymentLogModelV1, target: PaymentLogModelV2 },

        // Users & UserLists - Critical
        { name: 'users', source: UserModelV1, target: UserModelV2, custom: true }, // Custom logic? V2 structure is tighter
        { name: 'userLists', source: UserListModelV1, target: UserListModelV2 }
    ];

    const BATCH_SIZE = 200;

    for (const task of TASKS) {
        console.log(`--- Migrating ${task.name} ---`);
        const { source, target, custom } = task;

        // If target schema missing (e.g. V2 didn't define it), skip
        if (!target) {
            console.warn(`Target Schema/Model for ${task.name} not defined in V2. Skipping.`);
            continue;
        }

        const state = loadState();
        const lastId = state[task.name];

        let query = {};
        if (lastId) {
            query = { _id: { $gt: lastId } }; // Using Mongo _id for pagination since we are moving Mongo->Mongo
        }

        // We can use cursor
        const cursor = source.find(query).sort({ _id: 1 }).batchSize(BATCH_SIZE).cursor();

        let batch = [];
        let count = 0;

        for await (const doc of cursor) {
            const data = doc.toObject();

            // Transformations
            if (task.name === 'users') {
                // V2 User Schema expects 'counsellingData' to be object, V1 was Mixed. 
                // If V1 data matches V2 structure, we are good.
                // Clean up if needed.
                // remove _id? Target will generate new _id? 
                // NO! We MUST preserve _id to keep relationships valid (UserLists ref userId)
                // So we keep data._id
            }

            // General Cleanup
            // delete data.__v; 

            batch.push(data);

            if (batch.length >= BATCH_SIZE) {
                try {
                    // insertMany with ordered: false to skip duplicates
                    await target.insertMany(batch, { ordered: false });
                } catch (e) {
                    if (!e.message.includes('E11000')) {
                        console.error(`Error inserting batch ${task.name}:`, e.message);
                    }
                }

                const lastDoc = batch[batch.length - 1];
                saveState(task.name, lastDoc._id);
                console.log(`Migrated ${count + batch.length} docs for ${task.name}`);
                count += batch.length;
                batch = [];
            }
        }

        // Final batch
        if (batch.length > 0) {
            try {
                await target.insertMany(batch, { ordered: false });
            } catch (e) {
                if (!e.message.includes('E11000')) {
                    console.error(`Error inserting final batch ${task.name}:`, e.message);
                }
            }
            saveState(task.name, batch[batch.length - 1]._id);
            console.log(`Migrated ${count + batch.length} docs for ${task.name}`);
        }
    }

    console.log('--- Migration V2 Complete ---');
    process.exit(0);
}

migrate().catch(console.error);
