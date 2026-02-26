/**
 * SchemasV3.js
 *
 * Comprehensive Mongoose schema definitions derived directly from Firebase backup
 * data. Each collection has a properly-typed schema with explicit `ref` annotations
 * on every cross-collection foreign key.
 *
 * ─── ID STRATEGY ───────────────────────────────────────────────────────────
 * All IDs are Firestore string UIDs (NOT MongoDB ObjectIds).
 * Every cross-collection ref uses `type: String` (not mongoose.Types.ObjectId).
 * Mongoose `.populate()` works with string refs as long as the referenced model's
 * primary key is the same string stored in the `id` field. Since the services
 * currently query by `.id` (string), this is fully backward-compatible.
 *
 * ─── RELATIONSHIP MAP ──────────────────────────────────────────────────────
 *
 *   UserList.userId              → User.id                  (String ref)
 *   UserList.originalListId      → MasterList.id            (String ref)
 *   UserList.colleges[].id       → College.id               (String ref, denormalised snapshot)
 *
 *   MasterList.folderId          → ListFolder.id            (String ref)
 *   MasterList.userIds[]         → User.id                  (String ref)
 *   MasterList.colleges[].id     → College.id               (String ref, denormalised snapshot)
 *   MasterList.createdBy         → Admin.email              (logical ref, no populate)
 *   MasterList.lastUpdatedBy     → Admin.email              (logical ref, no populate)
 *
 *   Cancellation.userId          → User.id                  (String ref)
 *   Cancellation.orderId         → User.orders[].orderId    (logical ref, embedded)
 *
 *   Note.id                      → User.id                  (1:1 document keyed by userId)
 *   Note.<adminEmail> keys       → Admin.email              (dynamic keys, not refable)
 *
 *   PremiumPlanItem.form         → CounsellingForm.id       (String ref)
 *
 *   Metadata.userIdList[]        → User.id                  (String ref)
 *
 *   Admin.id                     — standalone (no upstream ref)
 *   User.id                      — standalone (no upstream ref)
 *   College.id                   — standalone (no upstream ref)
 *   ListFolder.id                — standalone (no upstream ref)
 *   CounsellingForm.id           — standalone (no upstream ref)
 *   RegistrationForm.id          — standalone (no upstream ref)
 *   DynamicScreen.id             — standalone (no upstream ref)
 *   Permission.id                — standalone (maps to role name)
 *
 * ─── COLLECTIONS (18 total) ────────────────────────────────────────────────
 *   1.  admins
 *   2.  users
 *   3.  user_lists     → UserList   (per-user copy of a list)
 *   4.  lists          → MasterList (admin-created, source of truth)
 *   5.  colleges_v4    → College
 *   6.  landingPage    → 4 schemas by document id:
 *          a. LandingPageContact      (id: "contact")
 *          b. LandingPageHomepage     (id: "homepage")
 *          c. LandingPagePremiumPlans (id: "premiumPlans")
 *          d. LandingPageReviews      (id: "reviews")
 *   7.  counsellingForms
 *   8.  registrationForm
 *   9.  dynamicScreens
 *  10.  permissions
 *  11.  appointments
 *  12.  cancellations
 *  13.  college_updates
 *  14.  downtimePayments
 *  15.  list_folders
 *  16.  notes
 *  17.  paymentLogs
 *  18.  metadata
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// Shared / Re-usable Sub-Schemas
// ─────────────────────────────────────────────────────────────────────────────

/** College cutoff entry (used in both College and recommended_colleges) */
const CutoffSchema = new Schema({
    category: { type: String },
    percentile: { type: Number },
    rank: { type: Number },
    capRound: { type: String },   // "cap1" | "cap2" | "cap3"
    year: { type: Number }
}, { _id: false });

/** Branch with cutoffs (used in College and homepage recommended_colleges) */
const BranchSchema = new Schema({
    branchCode: { type: String },
    branchName: { type: String },
    branchShort: { type: String },
    cutoffs: { type: [CutoffSchema], default: [] }
}, { _id: false });

/**
 * College item embedded inside a list (MasterList or UserList).
 * `id` is a denormalised snapshot — the canonical record lives in College.
 * We keep `ref` as a comment because Mongoose does not support array-of-subdoc
 * populate via string id without a custom plugin, but the intent is documented.
 */
export const ListCollegeSchema = new Schema({
    id: { type: String },           // → College.id  (denormalised snapshot)
    instituteCode: { type: String },
    instituteName: { type: String },
    city: { type: String },
    uniqueId: { type: String },
    selectedBranch: { type: String },
    selectedBranchCode: { type: String },
    category: { type: String },
    originalIndex: { type: Number },
    keywords: { type: [String], default: [] },
    additionalMetadata: {
        status: String,
        totalIntake: Number,
        autonomyStatus: String,
        minorityStatus: String,
        address: String,
        region: String,
        university: String,
        fees: Number
    }
}, { _id: false });


// ─────────────────────────────────────────────────────────────────────────────
// 1. Admin Schema
// ─────────────────────────────────────────────────────────────────────────────

export const AdminSchema = new Schema({
    id: { type: String, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    role: { type: String, enum: ['admin', 'super-admin', 'editor'], default: 'admin' },
    pages: { type: [String], default: [] }, // Individual page permissions
    components: { type: [String], default: [] } // Individual component permissions
}, { timestamps: true });

// ─────────────────────────────────────────────────────────────────────────────
// Admin Activity Schema
// Logs admin actions (used to be stored as subcollection in Firestore)
// ─────────────────────────────────────────────────────────────────────────────

export const AdminActivitySchema = new Schema({
    id: { type: String, unique: true, index: true },
    adminId: { type: String, required: true, index: true, ref: 'Admin' }, // → Admin.id
    adminEmail: { type: String, index: true }, // Admin email for quick reference
    method: { type: String, required: true }, // GET, POST, PUT, DELETE, etc.
    path: { type: String, required: true, index: true }, // API endpoint path
    params: { type: Schema.Types.Mixed }, // Route params (e.g., :id)
    query: { type: Schema.Types.Mixed }, // Query string params (e.g., ?page=1)
    body: { type: Schema.Types.Mixed }, // Request body
    status: { type: Number }, // HTTP status code
    response: { type: Schema.Types.Mixed }, // Response data
    timestamp: { type: Date, required: true, index: true },
    ip: { type: String }, // Client IP
    userAgent: { type: String } // Client user agent
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 2. User Schema
// ─────────────────────────────────────────────────────────────────────────────

const UserCounsellingDataSchema = new Schema({
    fullName: String,
    dob: String,
    city: String,
    category: String,
    isDefense: String,       // "YES" | "NO"
    isPwd: String,       // "YES" | "NO"
    boardMarks: String,
    boardType: String,       // "State Board" | "CBSC" | "ICSE"
    cetPercentile: String,
    jeeMarks: String,
    jeePercentile: String,
    jeeSeatNumber: String,
    cetMarks: String,
    cetSeatNumber: String,
    budget: String,
    termsAccepted: Boolean,
    preferredLocations: String,
    email: String,
    name: String
}, { _id: false });

const PaymentDetailsSchema = new Schema({
    id: String,
    entity: String,
    amount: Number,
    currency: String,
    status: String,
    order_id: String,
    method: String,
    email: String,
    contact: String,
    created_at: Number,
    fee: Number,
    tax: Number,
    error_code: String,
    error_description: String
}, { _id: false, strict: false });

const OrderSchema = new Schema({
    orderId: String,
    amount: Number,
    currency: String,
    receipt: String,
    status: String,
    createdAt: Date,
    paymentStatus: String,
    updatedAt: Date,
    paymentId: String,
    paymentDetails: PaymentDetailsSchema,
    notes: Schema.Types.Mixed
}, { _id: false });

export const UserSchema = new Schema({
    id: { type: String, unique: true, index: true },
    phone: { type: String, unique: true, sparse: true, index: true },
    name: String,
    email: { type: String, index: true, sparse: true },

    // Auth & Status
    isPremium: { type: Boolean, default: false },
    hasLoggedIn: Boolean,
    firstLogin: Boolean,
    phoneVerified: Boolean,
    otp: String,
    otpExpiry: Date,
    currentDeviceId: String,
    oneSignalId: String,

    counsellingData: UserCounsellingDataSchema,

    // Orders
    currentOrderId: String,
    orderIds: { type: [String], default: [] },
    orders: { type: [OrderSchema], default: [] },

    // Premium Info
    premiumPlan: {
        id: String,
        purchasedDate: Date,
        form: String,
        expiryDate: Date,
        planTitle: String,
        isPaymentPending: Boolean,
        amountRemaining: Number,
        price: Number,
        validity: Date,
        plan: String
    },
    batch: String,

    // Steps progress (structure varies per step logic — kept Mixed intentionally)
    stepsData: {
        id: String,
        steps: Schema.Types.Mixed
    }
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 3. UserList Schema
//    Per-user copy of a MasterList, created when admin assigns a list to a user.
//    Relations:
//      userId         → User.id
//      originalListId → MasterList.id
//      colleges[].id  → College.id  (denormalised snapshot inside the array)
// ─────────────────────────────────────────────────────────────────────────────

export const UserListSchema = new Schema({
    id: { type: String, unique: true, index: true },

    userId: {
        type: String,
        required: true,
        index: true,
        ref: 'User'           // → User.id
    },
    type: { type: String, enum: ['assigned', 'created'], default: 'assigned' },
    title: String,

    originalListId: {
        type: String,
        ref: 'MasterList'         // → MasterList.id
    },

    colleges: { type: [ListCollegeSchema], default: [] },
    isCustomized: { type: Boolean, default: false },
    customized: { type: Boolean, default: false },   // legacy duplicate

    lastUpdatedBy: { type: String },  // Admin email — logical ref to Admin.email
    data: Schema.Types.Mixed          // legacy fallback
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 4. MasterList Schema
//    Admin-created curated college list — the source of truth.
//    Lives in the `lists/` backup directory.
//    Relations:
//      folderId       → ListFolder.id
//      userIds[]      → User.id           (which users this was assigned to)
//      colleges[].id  → College.id        (denormalised snapshot inside array)
//      createdBy      → Admin.email       (logical ref — not populate-able)
//      lastUpdatedBy  → Admin.email       (logical ref — not populate-able)
// ─────────────────────────────────────────────────────────────────────────────

export const MasterListSchema = new Schema({
    id: { type: String, unique: true, index: true },
    title: { type: String, required: true },

    // Default category filter applied when the list is assigned
    category: { type: String },

    folderId: {
        type: String,
        index: true,
        ref: 'ListFolder'        // → ListFolder.id  (null = no folder)
    },

    userIds: {
        type: [{ type: String, ref: 'User' }],   // → [User.id]
        default: []
    },

    colleges: { type: [ListCollegeSchema], default: [] },

    // Soft-delete metadata
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deleteFolderId: { type: String, default: null, index: true },

    createdBy: { type: String },  // Admin.email — logical ref
    lastUpdatedBy: { type: String },  // Admin.email — logical ref
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 5. College Schema
// ─────────────────────────────────────────────────────────────────────────────

export const CollegeSchema = new Schema({
    id: { type: String, unique: true, index: true },
    instituteCode: { type: Number, index: true },
    instituteName: { type: String, index: 'text' },
    city: { type: String, index: true },
    branches: { type: [BranchSchema], default: [] },
    keywords: { type: [String], default: [] },
    additionalMetadata: {
        status: String,
        totalIntake: Number,
        autonomyStatus: String,
        minorityStatus: String,
        address: String,
        region: String,
        university: String
    },
    searchIndex: {
        instituteCodeName: String,
        instituteCodeCity: String,
        instituteCityName: String
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// 6. Landing Page — 4 Separate Schemas (one per document type)
// ─────────────────────────────────────────────────────────────────────────────

// 6a. LandingPage: Contact  (id: "contact")
export const LandingPageContactSchema = new Schema({
    id: { type: String, unique: true, index: true, default: 'contact' },
    address: { value: String, link: String },
    company: { name: String },
    youtube: String,
    whatsapp: { groupinvite: String, number: String },
    phone: String,
    updatedAt: Date
}, { timestamps: true });

// 6b. LandingPage: Homepage  (id: "homepage")
const HomepageBannerSchema = new Schema({
    id: String,
    title: String,
    url: String,
    bannerUrl: String,
    isInAppNavigation: Boolean,
    isForCounsellingDashboard: Boolean,
    html: String
}, { _id: false });

const HomepageEventSchema = new Schema({
    id: String,
    title: String,
    date: String,
    description: String,
    type: String,
    link: String
}, { _id: false });

const HomepageUpdateSchema = new Schema({
    id: String,
    title: String,
    subtitle: String,
    type: String,
    date: String,
    link: String,
    thumbnail: String
}, { _id: false });

const RecommendedCollegeSchema = new Schema({
    id: String,    // → College.id  (denormalised snapshot)
    instituteCode: String,
    instituteName: String,
    city: String,
    branches: { type: [BranchSchema], default: [] }
}, { _id: false });

export const LandingPageHomepageSchema = new Schema({
    id: { type: String, unique: true, index: true, default: 'homepage' },
    title: { english: String, marathi: String },
    slogan: { marathi: String, english: String },
    ctaText: { marathi: String, english: String },
    videoUrl: String,
    testimonials: [{
        name: String,
        designation: String,
        feedback: String,
        _id: false
    }],
    features: [{
        marathi: String,
        english: String,
        _id: false
    }],
    banners: { type: [HomepageBannerSchema], default: [] },
    events: { type: [HomepageEventSchema], default: [] },
    updates: { type: [HomepageUpdateSchema], default: [] },
    recommended_colleges: { type: [RecommendedCollegeSchema], default: [] }
}, { timestamps: true });

// 6c. LandingPage: PremiumPlans  (id: "premiumPlans")
//   `plans[].form` references a CounsellingForm document by its string id.
export const PremiumPlanItemSchema = new Schema({
    title: String,
    price: Number,
    opensAt: Date,
    form: {
        type: String,
        ref: 'CounsellingForm'    // → CounsellingForm.id
    },
    isLocked: Boolean,
    lockedText: String,
    buttonText: String,
    benefits: { type: [String], default: [] }
}, { _id: false });

export const LandingPagePremiumPlansSchema = new Schema({
    id: { type: String, unique: true, index: true, default: 'premiumPlans' },
    plans: { type: [PremiumPlanItemSchema], default: [] }
}, { timestamps: true });

// 6d. LandingPage: Reviews  (id: "reviews")
export const ReviewItemSchema = new Schema({
    id: String,
    firstName: String,
    lastName: String,
    feedback: String,
    college: String,
    branch: String,
    timestamp: String,
    district: String,
    gender: String,      // "Male" | "Female"
    featured: Boolean,
    photoUrl: String
}, { _id: false });

export const LandingPageReviewsSchema = new Schema({
    id: { type: String, unique: true, index: true, default: 'reviews' },
    data: { type: [ReviewItemSchema], default: [] }
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 7. CounsellingForm Schema
// ─────────────────────────────────────────────────────────────────────────────

export const CounsellingFormStepSchema = new Schema({
    number: { type: Number },
    title: { type: String },
    description: { type: String },
    showListButton: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    premiumOnly: { type: Boolean, default: true },
    isCapSpecific: { type: Boolean, default: false },
    cap: { type: Number },
    isVerdict: { type: Boolean, default: false },
    isCapQuery: { type: Boolean, default: false }
}, { _id: false });

export const CounsellingFormSchema = new Schema({
    id: { type: String, unique: true, index: true },
    lastUpdatedBy: { type: String },   // Admin.email — logical ref
    steps: { type: [CounsellingFormStepSchema], default: [] },
    updatedAt: Date
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 8. RegistrationForm Schema
// ─────────────────────────────────────────────────────────────────────────────

export const RegistrationFieldSchema = new Schema({
    id: String,
    key: String,      // maps to User.counsellingData.<key>
    label: String,
    type: { type: String },  // "text"|"number"|"date"|"select"|"password"|"checkbox"
    required: Boolean,
    additionalRemarks: String,
    options: { type: [String], default: [] },
    isLocked: Boolean
}, { _id: false });

export const RegistrationFormStepSchema = new Schema({
    title: String,
    fields: { type: [RegistrationFieldSchema], default: [] }
}, { _id: false });

export const RegistrationFormSchema = new Schema({
    id: { type: String, unique: true, index: true },
    steps: { type: [RegistrationFormStepSchema], default: [] },
    updatedAt: Date
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 9. DynamicScreen Schema
// ─────────────────────────────────────────────────────────────────────────────

export const DynamicScreenItemSchema = new Schema({
    title: String,
    url: String,
    html: String,
    isPremiumOnly: Boolean,
    plan: String   // plan title filter (empty = all plans)
}, { _id: false });

export const DynamicScreenSchema = new Schema({
    id: { type: String, unique: true, index: true },
    title: String,
    html: String,
    url: String,
    isPremiumOnly: Boolean,
    plan: String,   // plan title filter (empty = all plans)
    data: { type: [DynamicScreenItemSchema], default: [] },
    updatedAt: Date
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 10. Permission Schema
//   `id` = role name e.g. "super-admin", "admin", "editor"
//   No upstream ref — permissions are looked up by role name (id)
// ─────────────────────────────────────────────────────────────────────────────

export const PermissionSchema = new Schema({
    id: { type: String, unique: true, index: true },
    role: String,
    pages: { type: [String], default: [] },
    components: { type: [String], default: [] } // Analytics dashboard components
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 11. Appointment Schema
// ─────────────────────────────────────────────────────────────────────────────

export const AppointmentSchema = new Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    phone: String,
    reason: String,
    status: { type: String, default: '' }   // optional status field present in some docs
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 12. Cancellation Schema
//   Relations:
//     userId  → User.id
//     orderId → User.orders[].orderId  (logical ref — order is embedded in User)
// ─────────────────────────────────────────────────────────────────────────────

export const CancellationSchema = new Schema({
    id: { type: String, unique: true, index: true },
    reason: String,
    plan: String,
    amount: Number,

    orderId: {
        type: String    // → User.orders[].orderId  (logical, embedded — no model ref)
    },

    userId: {
        type: String,
        index: true,
        ref: 'User'  // → User.id
    },

    userPhone: String,
    name: String,
    phone: String
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 13. CollegeUpdate Schema
// ─────────────────────────────────────────────────────────────────────────────

export const CollegeUpdateSchema = new Schema({
    id: { type: String, unique: true, index: true },
    deleted: Boolean,
    date: Date,
    title: String,
    subtitle: String,
    type: String,
    link: String,
    thumbnail: String
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 14. DowntimePayment Schema  (sparse — only id is known from backups)
// ─────────────────────────────────────────────────────────────────────────────

export const DowntimePaymentSchema = new Schema({
    id: { type: String, unique: true, index: true }
}, { strict: false, timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 15. ListFolder Schema
//   Folders are admin-managed containers for MasterLists.
//   MasterList.folderId → ListFolder.id
// ─────────────────────────────────────────────────────────────────────────────

export const ListFolderSchema = new Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    description: String,
    // isArchive can come in as "true" (string) from old Firestore exports — coerce to Boolean
    isArchive: { type: Boolean, default: false, set: (v) => v === true || v === 'true' },
    createdBy: { type: String },   // Admin.email — logical ref
    list_count: { type: Number, default: 0 }
}, { timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 16. Note Schema
//   Each document's `id` = the User.id it belongs to (1:1 per user).
//   Remaining keys are dynamic: `note-<adminEmail>: { createdAt, note }`.
//   Cannot use strict schema for dynamic keys → strict: false.
//   Relations:
//     id  → User.id    (document id is the user id)
//     dynamic keys     → Admin.email  (logical only — dynamic keys not refable)
// ─────────────────────────────────────────────────────────────────────────────

export const NoteSchema = new Schema({
    id: {
        type: String,
        unique: true,
        index: true,
        ref: 'User'    // → User.id  (this note doc belongs to this user)
    }
}, { strict: false, timestamps: true });


// ─────────────────────────────────────────────────────────────────────────────
// 17. PaymentLog Schema
// ─────────────────────────────────────────────────────────────────────────────

export const PaymentLogSchema = new Schema({
    id: { type: String, unique: true, index: true },
    eventType: String,
    data: Schema.Types.Mixed,
    timestamp: Date
});


// ─────────────────────────────────────────────────────────────────────────────
// 18. Metadata Schema
//   userIdList[] → User.id  (the master registry of all user IDs)
// ─────────────────────────────────────────────────────────────────────────────

export const MetadataSchema = new Schema({
    id: {
        type: String,
        unique: true,
        index: true
    },
    userIdList: {
        type: [{ type: String, ref: 'User' }],   // → [User.id]
        default: []
    },
    version: Number,
    enabled: { type: [String], default: [] },
    total: { type: [String], default: [] }
}, { strict: false, timestamps: true });
