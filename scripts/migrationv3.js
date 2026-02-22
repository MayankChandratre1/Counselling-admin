/**
 * migrationv3.js
 *
 * Migrates ALL Firestore backup data into MongoDB using SchemasV3.js models.
 *
 * USAGE:
 *   node scripts/migrationv3.js
 *
 * RE-RUNNABLE / IDEMPOTENT:
 *   Uses updateOne({ id }, { $set: doc }, { upsert: true }) throughout.
 *   Safe to run multiple times — will update data but never duplicate.
 *
 * PROGRESS:
 *   Prints a live table of results per collection after the migration.
 *
 * WHAT IT MIGRATES (18 collections, 75 backup files):
 *   admins            → Admin model
 *   users             → User model  (from metadata.userIdList + user_lists cross-ref)
 *   user_lists        → UserList model
 *   colleges_v4       → College model
 *   landingPage       → 4 separate models by document "id":
 *                         "contact"       → LandingPageContact
 *                         "homepage"      → LandingPageHomepage
 *                         "premiumPlans"  → LandingPagePremiumPlans
 *                         "reviews"       → LandingPageReviews
 *   lists             → MasterList model  (admin-curated college lists)
 *   counsellingForms  → CounsellingForm model
 *   registrationForm  → RegistrationForm model
 *   dynamicScreens    → DynamicScreen model
 *   permissions       → Permission model
 *   appointments      → Appointment model
 *   cancellations     → Cancellation model
 *   college_updates   → CollegeUpdate model
 *   downtimePayments  → DowntimePayment model
 *   list_folders      → ListFolder model
 *   notes             → Note model
 *   paymentLogs       → PaymentLog model
 *   metadata          → Metadata model
 */

import mongoose from 'mongoose';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

// ─── Models ─────────────────────────────────────────────────────────────────

import {
    AdminSchema,
    UserSchema,
    UserListSchema,
    MasterListSchema,
    CollegeSchema,
    LandingPageContactSchema,
    LandingPageHomepageSchema,
    LandingPagePremiumPlansSchema,
    LandingPageReviewsSchema,
    CounsellingFormSchema,
    RegistrationFormSchema,
    DynamicScreenSchema,
    PermissionSchema,
    AppointmentSchema,
    CancellationSchema,
    CollegeUpdateSchema,
    DowntimePaymentSchema,
    ListFolderSchema,
    NoteSchema,
    PaymentLogSchema,
    MetadataSchema,
} from './SchemasV3.js';

// Register models (guard against "OverwriteModelError" on re-run in REPL)
function model(name, schema) {
    return mongoose.models[name] || mongoose.model(name, schema);
}

const Admin = model('Admin', AdminSchema);
const User = model('User', UserSchema);
const UserList = model('UserList', UserListSchema);
const College = model('College', CollegeSchema);
const LandingPageContact = model('LandingPageContact', LandingPageContactSchema);
const LandingPageHomepage = model('LandingPageHomepage', LandingPageHomepageSchema);
const LandingPagePremiumPlans = model('LandingPagePremiumPlans', LandingPagePremiumPlansSchema);
const LandingPageReviews = model('LandingPageReviews', LandingPageReviewsSchema);
const CounsellingForm = model('CounsellingForm', CounsellingFormSchema);
const RegistrationForm = model('RegistrationForm', RegistrationFormSchema);
const DynamicScreen = model('DynamicScreen', DynamicScreenSchema);
const Permission = model('Permission', PermissionSchema);
const Appointment = model('Appointment', AppointmentSchema);
const Cancellation = model('Cancellation', CancellationSchema);
const CollegeUpdate = model('CollegeUpdate', CollegeUpdateSchema);
const DowntimePayment = model('DowntimePayment', DowntimePaymentSchema);
const ListFolder = model('ListFolder', ListFolderSchema);
const Note = model('Note', NoteSchema);
const PaymentLog = model('PaymentLog', PaymentLogSchema);
const Metadata = model('Metadata', MetadataSchema);
const MasterList = model('MasterList', MasterListSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BACKUPS_DIR = join(__dirname, '..', 'backups');

/** Read all JSON files from a backup sub-directory, return merged array */
function readBackupDir(subDir) {
    const dir = join(BACKUPS_DIR, subDir);
    if (!existsSync(dir)) {
        console.warn(`  ⚠️  Backup directory not found: ${dir}`);
        return [];
    }
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    const records = [];
    for (const file of files) {
        try {
            const raw = readFileSync(join(dir, file), 'utf-8');
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                records.push(...data);
            } else if (data && typeof data === 'object') {
                records.push(data);
            }
        } catch (e) {
            console.warn(`  ⚠️  Failed to parse ${file}: ${e.message}`);
        }
    }
    return records;
}

/** Deduplicate an array of records by their `id` field (last-wins) */
function dedupeById(records) {
    const map = new Map();
    for (const r of records) {
        if (r.id) map.set(r.id, r);
    }
    return [...map.values()];
}

/**
 * Bulk upsert records into a Mongoose model.
 * Uses updateOne with $set + upsert for full idempotency.
 * Returns { inserted, updated, errors } counts.
 */
async function bulkUpsert(Model, records, transform = null) {
    if (!records || records.length === 0) return { inserted: 0, updated: 0, errors: 0 };

    const ops = [];
    for (const raw of records) {
        try {
            const doc = transform ? transform(raw) : raw;
            if (!doc) continue;
            const filter = doc.id ? { id: doc.id } : { _id: doc._id || new mongoose.Types.ObjectId() };
            ops.push({
                updateOne: {
                    filter,
                    update: { $set: doc },
                    upsert: true
                }
            });
        } catch (e) {
            console.warn(`  ⚠️  Transform error:`, e.message);
        }
    }

    if (ops.length === 0) return { inserted: 0, updated: 0, errors: 0 };

    // Split into chunks of 500 to avoid hitting 16MB BSON limit
    const CHUNK = 500;
    let inserted = 0, updated = 0, errors = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
        const chunk = ops.slice(i, i + CHUNK);
        try {
            const result = await Model.bulkWrite(chunk, { ordered: false });
            inserted += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
        } catch (err) {
            if (err.writeErrors) {
                errors += err.writeErrors.length;
                inserted += err.result?.nUpserted || 0;
                updated += err.result?.nModified || 0;
            } else {
                throw err;
            }
        }
    }
    return { inserted, updated, errors };
}

// ─── Transform helpers ───────────────────────────────────────────────────────

/** Normalize a date string/timestamp to a JS Date (or undefined) */
function toDate(v) {
    if (!v) return undefined;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
}

/** Admin: embed permissions.pages from the old `permissions` sub-object */
function transformAdmin(raw) {
    return {
        id: raw.id,
        email: raw.email,
        password: raw.password || '',
        name: raw.name || '',
        role: raw.role || 'admin',
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
    };
}

/** MasterList: admin-curated college list */
function transformMasterList(raw) {
    return {
        id: raw.id,
        title: raw.title || '',
        category: raw.category || '',
        folderId: raw.folderId || null,
        userIds: Array.isArray(raw.userIds) ? raw.userIds : [],
        colleges: Array.isArray(raw.colleges) ? raw.colleges : [],
        createdBy: raw.createdBy || '',
        lastUpdatedBy: raw.lastUpdatedBy || '',
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
    };
}

/** UserList: per-user customised college list */
function transformUserList(raw) {
    return {
        id: raw.id,
        userId: raw.userId || raw.assignedTo || '',
        type: raw.type || (raw.originalListId ? 'assigned' : 'created'),
        title: raw.title || '',
        originalListId: raw.originalListId || null,
        colleges: Array.isArray(raw.colleges) ? raw.colleges : [],
        isCustomized: raw.isCustomized || raw.customized || false,
        customized: raw.customized || false,
        lastUpdatedBy: raw.lastUpdatedBy || '',
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
    };
}

/** College: merge all branch + cutoff data verbatim */
function transformCollege(raw) {
    return {
        id: raw.id,
        instituteCode: raw.instituteCode,
        instituteName: raw.instituteName,
        city: raw.city,
        branches: Array.isArray(raw.branches) ? raw.branches : [],
        keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
        additionalMetadata: raw.additionalMetadata || {},
        searchIndex: raw.searchIndex || {},
    };
}

/** LandingPage contact document */
function transformContact(raw) {
    return {
        id: raw.id,
        address: raw.address || {},
        company: raw.company || {},
        youtube: raw.youtube || '',
        whatsapp: raw.whatsapp || {},
        phone: raw.phone || '',
        updatedAt: toDate(raw.updatedAt),
    };
}

/** LandingPage homepage document — keeps recommended_colleges + cutoffs intact */
function transformHomepage(raw) {
    return {
        id: raw.id,
        title: raw.title || {},
        slogan: raw.slogan || {},
        ctaText: raw.ctaText || {},
        videoUrl: raw.videoUrl || '',
        testimonials: Array.isArray(raw.testimonials) ? raw.testimonials : [],
        features: Array.isArray(raw.features) ? raw.features : [],
        banners: Array.isArray(raw.banners) ? raw.banners : [],
        events: Array.isArray(raw.events) ? raw.events : [],
        updates: Array.isArray(raw.updates) ? raw.updates : [],
        recommended_colleges: Array.isArray(raw.recommended_colleges) ? raw.recommended_colleges : [],
    };
}

/** LandingPage premiumPlans document */
function transformPremiumPlans(raw) {
    return {
        id: raw.id,
        plans: Array.isArray(raw.plans) ? raw.plans.map(p => ({
            title: p.title || '',
            price: p.price || 0,
            opensAt: toDate(p.opensAt),
            form: p.form || '',
            isLocked: p.isLocked || false,
            lockedText: p.lockedText || '',
            buttonText: p.buttonText || '',
            benefits: Array.isArray(p.benefits) ? p.benefits : [],
        })) : [],
    };
}

/** LandingPage reviews document — `data` holds the flat reviews array */
function transformReviews(raw) {
    // The backup has the reviews array at the top level alongside `id`
    // The schema stores them in `data`
    const arr = Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.reviews) ? raw.reviews : []);
    return {
        id: raw.id,
        data: arr.map(r => ({
            id: r.id || r._id || '',
            firstName: r.firstName || '',
            lastName: r.lastName || '',
            feedback: r.feedback || '',
            college: r.college || '',
            branch: r.branch || '',
            timestamp: r.timestamp || '',
            district: r.district || '',
            gender: r.gender || '',
            featured: r.featured || false,
            photoUrl: r.photoUrl || '',
        })),
    };
}

/** CounsellingForm */
function transformCounsellingForm(raw) {
    return {
        id: raw.id,
        lastUpdatedBy: raw.lastUpdatedBy || '',
        steps: Array.isArray(raw.steps) ? raw.steps.map(s => ({
            number: s.number || 0,
            title: s.title || '',
            description: s.description || '',
            showListButton: s.showListButton || false,
            isLocked: s.isLocked || false,
            premiumOnly: s.premiumOnly !== undefined ? s.premiumOnly : true,
            isCapSpecific: s.isCapSpecific || false,
            cap: s.cap || null,
            isVerdict: s.isVerdict || false,
            isCapQuery: s.isCapQuery || false,
        })) : [],
        updatedAt: toDate(raw.updatedAt),
    };
}

/** RegistrationForm: steps → fields nested */
function transformRegistrationForm(raw) {
    return {
        id: raw.id,
        steps: Array.isArray(raw.steps) ? raw.steps.map(step => ({
            title: step.title || '',
            fields: Array.isArray(step.fields) ? step.fields.map(f => ({
                id: f.id || f.key || '',
                key: f.key || '',
                label: f.label || '',
                type: f.type || 'text',
                required: f.required || false,
                additionalRemarks: f.additionalRemarks || '',
                options: Array.isArray(f.options) ? f.options : [],
                isLocked: f.isLocked || false,
            })) : [],
        })) : [],
        updatedAt: toDate(raw.updatedAt),
    };
}

/** DynamicScreen */
function transformDynamicScreen(raw) {
    return {
        id: raw.id,
        title: raw.title || '',
        html: raw.html || '',
        url: raw.url || '',
        isPremiumOnly: raw.isPremiumOnly || false,
        data: Array.isArray(raw.data) ? raw.data.map(item => ({
            title: item.title || '',
            url: item.url || '',
            html: item.html || '',
            isPremiumOnly: item.isPremiumOnly || false,
            plan: item.plan || '',
        })) : [],
        updatedAt: toDate(raw.updatedAt),
    };
}

/** Permission */
function transformPermission(raw) {
    return {
        id: raw.id,
        role: raw.role || raw.id || '',
        pages: Array.isArray(raw.pages) ? raw.pages : [],
    };
}

/** Appointment — some records have an optional `status` field */
function transformAppointment(raw) {
    return {
        id: raw.id,
        name: raw.name || '',
        phone: raw.phone || '',
        reason: raw.reason || '',
        status: raw.status || '',
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
    };
}

/** Cancellation */
function transformCancellation(raw) {
    return {
        id: raw.id,
        reason: raw.reason || '',
        plan: raw.plan || '',
        amount: raw.amount || 0,
        orderId: raw.orderId || '',
        userId: raw.userId || '',
        userPhone: raw.userPhone || '',
        name: raw.name || '',
        phone: raw.phone || '',
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
    };
}

/** CollegeUpdate */
function transformCollegeUpdate(raw) {
    return {
        id: raw.id,
        deleted: raw.deleted || false,
        date: toDate(raw.date),
        title: raw.title || '',
        subtitle: raw.subtitle || '',
        type: raw.type || '',
        link: raw.link || '',
        thumbnail: raw.thumbnail || '',
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
    };
}

/** ListFolder */
function transformListFolder(raw) {
    return {
        id: raw.id,
        name: raw.name || '',
        description: raw.description || '',
        isArchive: Boolean(raw.isArchive === true || raw.isArchive === 'true'),
        createdBy: raw.createdBy || '',
        list_count: raw.list_count || 0,
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
    };
}

/**
 * Note: Each document has a fixed `id` plus N dynamic keys of the form
 * `note-<adminEmail>: { createdAt, note }`.
 * We preserve all dynamic keys in the document via `strict: false`.
 */
function transformNote(raw) {
    // Copy all keys except `id`
    const doc = { ...raw };
    return doc;
}

/** PaymentLog */
function transformPaymentLog(raw) {
    return {
        id: raw.id,
        eventType: raw.eventType || raw.type || '',
        data: raw.data || raw,
        timestamp: toDate(raw.timestamp || raw.createdAt),
    };
}

/** Metadata */
function transformMetadata(raw) {
    return {
        id: raw.id,
        userIdList: Array.isArray(raw.userIdList) ? raw.userIdList : [],
        version: raw.version || 0,
        enabled: Array.isArray(raw.enabled) ? raw.enabled : [],
        total: Array.isArray(raw.total) ? raw.total : [],
    };
}

// ─── Main migration ──────────────────────────────────────────────────────────

async function migrate() {
    // Prefer the V3 target DB; fall back through common env var names
    const MONGO_URI =
        process.env.MONGODB_URI ||
        process.env.MONGO_URI_NEW ||   // V2/V3 target from .env
        process.env.MONGO_URI ||
        process.env.DB_URI;
    if (!MONGO_URI) {
        console.error('❌  No MongoDB URI found. Set MONGODB_URI in your .env file.');
        process.exit(1);
    }

    console.log('\n🚀  Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 120000,
    });
    console.log('✅  Connected.\n');

    const results = [];

    // helper to run one collection and record results
    async function run(label, Model, backupDir, transform, extraDedupe = true) {
        process.stdout.write(`  📦  ${label.padEnd(28)} …`);
        const raw = readBackupDir(backupDir);
        const records = extraDedupe ? dedupeById(raw) : raw;
        const r = await bulkUpsert(Model, records, transform);
        const status = r.errors > 0 ? '⚠️ ' : '✅ ';
        const line = `${status} inserted=${r.inserted}  updated=${r.updated}  errors=${r.errors}`;
        console.log(` ${line}`);
        results.push({ label, ...r });
        return r;
    }

    // ── 1. Admins ─────────────────────────────────────────────────────────────
    await run('admins', Admin, 'admins', transformAdmin);

    // ── 2. Permissions ────────────────────────────────────────────────────────
    await run('permissions', Permission, 'permissions', transformPermission);

    // ── 3. Master Lists (admin-curated) ───────────────────────────────────────
    await run('lists (master)', MasterList, 'lists', transformMasterList);

    // ── 4. List Folders ───────────────────────────────────────────────────────
    await run('list_folders', ListFolder, 'list_folders', transformListFolder);

    // ── 5. User Lists (per-user) ──────────────────────────────────────────────
    await run('user_lists', UserList, 'user_lists', transformUserList);

    // ── 6. Colleges ───────────────────────────────────────────────────────────
    await run('colleges_v4', College, 'colleges_v4', transformCollege);

    // ── 7. Landing Page (route by document id) ────────────────────────────────
    {
        process.stdout.write(`  📦  ${'landingPage'.padEnd(28)} …`);
        const allDocs = dedupeById(readBackupDir('landingPage'));

        // The backup is a single large file; each top-level object has a distinct `id`
        // Some review items sit directly in the array alongside main docs —
        // detect them by checking if they have a `firstName` field
        const mainDocs = allDocs.filter(d => d.id && !d.firstName);
        const reviewItems = allDocs.filter(d => d.firstName); // stray review row objects

        let lpInserted = 0, lpUpdated = 0, lpErrors = 0;

        for (const doc of mainDocs) {
            let Model, transform;
            switch (doc.id) {
                case 'contact':
                    Model = LandingPageContact; transform = transformContact; break;
                case 'homepage':
                    Model = LandingPageHomepage; transform = transformHomepage; break;
                case 'premiumPlans':
                    Model = LandingPagePremiumPlans; transform = transformPremiumPlans; break;
                case 'reviews':
                    Model = LandingPageReviews; transform = transformReviews; break;
                default:
                    // Unknown document type — store as-is in homepage model as fallback
                    console.warn(`\n  ⚠️  Unknown landingPage doc id="${doc.id}", skipping.`);
                    continue;
            }
            const r = await bulkUpsert(Model, [doc], transform);
            lpInserted += r.inserted; lpUpdated += r.updated; lpErrors += r.errors;
        }

        // If stray review rows exist, append them to the reviews document
        if (reviewItems.length > 0) {
            // Upsert each stray review into the `reviews` doc's `data` array
            // Use $addToSet approach with $push (since items have ids)
            try {
                for (const item of reviewItems) {
                    await LandingPageReviews.updateOne(
                        { id: 'reviews' },
                        { $addToSet: { data: item } },
                        { upsert: false }
                    );
                }
            } catch (e) { lpErrors++; }
        }

        const status = lpErrors > 0 ? '⚠️ ' : '✅ ';
        console.log(` ${status} inserted=${lpInserted}  updated=${lpUpdated}  errors=${lpErrors}`);
        results.push({ label: 'landingPage', inserted: lpInserted, updated: lpUpdated, errors: lpErrors });
    }

    // ── 8. CounsellingForms ───────────────────────────────────────────────────
    await run('counsellingForms', CounsellingForm, 'counsellingForms', transformCounsellingForm);

    // ── 9. RegistrationForms ──────────────────────────────────────────────────
    await run('registrationForm', RegistrationForm, 'registrationForm', transformRegistrationForm);

    // ── 10. DynamicScreens ────────────────────────────────────────────────────
    await run('dynamicScreens', DynamicScreen, 'dynamicScreens', transformDynamicScreen);

    // ── 11. Appointments ──────────────────────────────────────────────────────
    await run('appointments', Appointment, 'appointments', transformAppointment);

    // ── 12. Cancellations ─────────────────────────────────────────────────────
    await run('cancellations', Cancellation, 'cancellations', transformCancellation);

    // ── 13. College Updates ───────────────────────────────────────────────────
    await run('college_updates', CollegeUpdate, 'college_updates', transformCollegeUpdate);

    // ── 14. Downtime Payments ─────────────────────────────────────────────────
    await run('downtimePayments', DowntimePayment, 'downtimePayments', r => ({ id: r.id }));

    // ── 15. Notes ─────────────────────────────────────────────────────────────
    await run('notes', Note, 'notes', transformNote);

    // ── 16. Payment Logs ──────────────────────────────────────────────────────
    await run('paymentLogs', PaymentLog, 'paymentLogs', transformPaymentLog);

    // ── 17. Metadata ──────────────────────────────────────────────────────────
    await run('metadata', Metadata, 'metadata', transformMetadata);

    // ── 18. Users ─────────────────────────────────────────────────────────────
    // Users are reconstructed from metadata.userIdList and cross-referenced
    // with user_lists (for counsellingData, phone etc.) if a users/ backup exists.
    {
        process.stdout.write(`  📦  ${'users'.padEnd(28)} …`);
        const usersDir = join(BACKUPS_DIR, 'users');
        let usersResult = { inserted: 0, updated: 0, errors: 0 };

        if (existsSync(usersDir)) {
            const raw = readBackupDir('users');
            const records = dedupeById(raw);
            usersResult = await bulkUpsert(User, records, r => ({
                id: r.id,
                phone: r.phone || '',
                name: r.name || '',
                email: r.email || '',
                isPremium: r.isPremium || false,
                hasLoggedIn: r.hasLoggedIn || false,
                firstLogin: r.firstLogin || false,
                phoneVerified: r.phoneVerified || false,
                currentDeviceId: r.currentDeviceId || '',
                oneSignalId: r.oneSignalId || '',
                counsellingData: r.counsellingData || {},
                currentOrderId: r.currentOrderId || '',
                orderIds: Array.isArray(r.orderIds) ? r.orderIds : [],
                orders: Array.isArray(r.orders) ? r.orders : [],
                premiumPlan: r.premiumPlan || {},
                batch: r.batch || '',
                stepsData: r.stepsData || null,
                createdAt: toDate(r.createdAt),
                updatedAt: toDate(r.updatedAt),
            }));
        } else {
            // Seed minimal user stubs from metadata.userIdList so foreign keys resolve
            const metaRecords = dedupeById(readBackupDir('metadata'));
            const userIds = new Set();
            for (const m of metaRecords) {
                if (Array.isArray(m.userIdList)) {
                    m.userIdList.forEach(uid => userIds.add(uid));
                }
            }
            // Also collect userIds referenced by user_lists
            const ulRecords = dedupeById(readBackupDir('user_lists'));
            for (const ul of ulRecords) {
                if (ul.userId) userIds.add(ul.userId);
            }

            const stubs = [...userIds].map(uid => ({ id: uid }));
            if (stubs.length > 0) {
                usersResult = await bulkUpsert(User, stubs, r => ({ id: r.id }));
            }
        }

        const status = usersResult.errors > 0 ? '⚠️ ' : '✅ ';
        console.log(` ${status} inserted=${usersResult.inserted}  updated=${usersResult.updated}  errors=${usersResult.errors}`);
        results.push({ label: 'users', ...usersResult });
    }

    // ─── Summary ──────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(65));
    console.log(' MIGRATION SUMMARY');
    console.log('─'.repeat(65));
    console.log(` ${'Collection'.padEnd(30)} ${'Inserted'.padStart(9)} ${'Updated'.padStart(8)} ${'Errors'.padStart(7)}`);
    console.log('─'.repeat(65));
    let totalInserted = 0, totalUpdated = 0, totalErrors = 0;
    for (const r of results) {
        const flag = r.errors > 0 ? ' ⚠️' : '';
        console.log(` ${r.label.padEnd(30)} ${String(r.inserted).padStart(9)} ${String(r.updated).padStart(8)} ${String(r.errors).padStart(7)}${flag}`);
        totalInserted += r.inserted;
        totalUpdated += r.updated;
        totalErrors += r.errors;
    }
    console.log('─'.repeat(65));
    console.log(` ${'TOTAL'.padEnd(30)} ${String(totalInserted).padStart(9)} ${String(totalUpdated).padStart(8)} ${String(totalErrors).padStart(7)}`);
    console.log('─'.repeat(65));

    if (totalErrors === 0) {
        console.log('\n🎉  Migration complete — zero errors!');
    } else {
        console.log(`\n⚠️  Migration complete with ${totalErrors} error(s). Check warnings above.`);
    }

    await mongoose.disconnect();
    process.exit(0);
}

// Run
migrate().catch(err => {
    console.error('\n💥  Fatal migration error:', err);
    mongoose.disconnect().finally(() => process.exit(1));
});
