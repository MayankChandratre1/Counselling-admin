import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Common Sub-Schemas
 * Used across multiple collections to ensure consistency.
 */

// Cutoff & Branch Schema (Embedded in College)
const CutoffSchema = new Schema({
    category: String,
    percentile: Number,
    rank: Number,
    capRound: String,
    year: Number
}, { _id: false });

const BranchSchema = new Schema({
    branchCode: String,
    branchName: String,
    branchShort: String,
    cutoffs: [CutoffSchema]
}, { _id: false });

// List College Item Schema (Embedded in Lists)
export const ListCollegeSchema = new Schema({
    id: String,
    instituteCode: String,
    instituteName: String,
    city: String,
    uniqueId: String,
    selectedBranch: String,
    selectedBranchCode: String,
    category: String,
    originalIndex: Number,
    // Optional: Include key snapshot data if needed, but keep it light
    keywords: [String],
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


/**
 * Core Domain Models
 */

// 1. Admin Schema
export const AdminSchema = new Schema({
    id: { type: String, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'super-admin'], default: 'admin' },
    permissions: {
        pages: [String]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });


// 2. User Schema & Sub-Schemas

const UserCounsellingDataSchema = new Schema({
    fullName: String,
    dob: String,
    city: String,
    category: String,
    isDefense: String,
    isPwd: String,
    boardMarks: String,
    boardType: String,
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
}, { _id: false, strict: false }); // Strict false for payment gateway variability

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
    phone: { type: String, unique: true, index: true },
    name: String,
    email: { type: String, index: true },

    // Auth & Status
    isPremium: { type: Boolean, default: false },
    hasLoggedIn: Boolean,
    firstLogin: Boolean,
    phoneVerified: Boolean,
    otp: String,
    otpExpiry: Date,
    currentDeviceId: String,
    oneSignalId: String,

    // Core Data
    counsellingData: UserCounsellingDataSchema, // Strict Typing

    // Orders
    currentOrderId: String,
    orderIds: [String],
    orders: [OrderSchema],

    // Premium Info
    premiumPlan: {
        title: String,
        price: Number,
        validity: Date
    },
    batch: String,

    // Steps Data (Keeping Mixed as structure varies by step logic)
    stepsData: {
        id: String,
        steps: Schema.Types.Mixed
    }
}, { timestamps: true });


// 3. UserList Schema (Separated from User for performance)
export const UserListSchema = new Schema({
    id: { type: String, unique: true, index: true },
    userId: { type: String, required: true, index: true, ref: 'User' }, // Added ref (logic ref)
    type: { type: String, enum: ['assigned', 'created'], default: 'assigned' },

    title: String,
    originalListId: String,
    colleges: [ListCollegeSchema],

    isCustomized: Boolean,
    customized: Boolean,
    lastUpdatedBy: String,

    // Legacy/Extra Data
    data: Schema.Types.Mixed
}, { timestamps: true });


// 4. College Schema
export const CollegeSchema = new Schema({
    id: { type: String, unique: true, index: true },
    instituteCode: { type: Number, index: true },
    instituteName: { type: String, index: 'text' }, // Text index for search
    city: { type: String, index: true },

    branches: [BranchSchema],

    keywords: [String],
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


// 5. Landing Page Schema (Polymorphic)
// Defines all known fields to minimize 'strict: false'
// Documents: 'homepage', 'premiumPlans', 'reviews', 'contact'

const LandingPageReviewSchema = new Schema({
    id: String,
    firstName: String,
    lastName: String,
    feedback: String,
    college: String,
    branch: String,
    timestamp: String,
    district: String,
    gender: String,
    featured: Boolean,
    photoUrl: String
}, { _id: false });

const PremiumPlanSchema = new Schema({
    title: String,
    price: Number,
    opensAt: Date,
    form: String,
    isLocked: Boolean,
    lockedText: String,
    buttonText: String,
    benefits: [String]
}, { _id: false });

const LandingPageEventSchema = new Schema({
    id: String,
    title: String,
    date: String,
    description: String,
    type: String,
    link: String
}, { _id: false });

export const LandingPageSchema = new Schema({
    id: { type: String, unique: true, index: true },

    // Content Fields (merged from all document types)
    title: Schema.Types.Mixed, // {english, marathi}
    slogan: { marathi: String, english: String },
    ctaText: { marathi: String, english: String },
    videoUrl: String,

    // Arrays
    testimonials: [{
        name: String,
        designation: String,
        feedback: String
    }],
    features: [{ marathi: String, english: String }],
    banners: [{
        id: String,
        title: String,
        url: String,
        bannerUrl: String,
        isInAppNavigation: Boolean,
        isForCounsellingDashboard: Boolean,
        html: String
    }],
    events: [LandingPageEventSchema],
    updates: [{
        id: String,
        title: String,
        subtitle: String,
        type: String,
        date: String,
        link: String,
        thumbnail: String
    }],
    recommended_colleges: [{
        id: String,
        instituteCode: String,
        instituteName: String,
        city: String,
        // concise version
    }],

    // Contact Info
    address: { value: String, link: String },
    company: { name: String },
    youtube: String,
    whatsapp: { groupinvite: String, number: String },
    phone: String,

    // Specific Sub-Collections Data
    plans: [PremiumPlanSchema], // for 'premiumPlans'
    data: [LandingPageReviewSchema], // for 'reviews'

}, { strict: false, timestamps: true }); // Keeping strict: false as safety net, but defined fields above will be cast


// 6. Other Specialized Schemas

export const AppointmentSchema = new Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    phone: String,
    reason: String
}, { timestamps: true });

export const CounsellingFormSchema = new Schema({
    id: { type: String, unique: true, index: true },
    lastUpdatedBy: String,
    steps: [Schema.Types.Mixed] // Complex steps structure
}, { timestamps: true });

export const RegistrationFormSchema = new Schema({
    id: { type: String, unique: true, index: true },
    steps: [Schema.Types.Mixed]
}, { timestamps: true });

export const PaymentLogSchema = new Schema({
    id: { type: String, unique: true, index: true },
    eventType: String,
    data: Schema.Types.Mixed,
    timestamp: Date
});

export const MetadataSchema = new Schema({
    id: { type: String, unique: true, index: true },
    userIdList: [String],
    version: Number,
    enabled: [String],
    total: [String]
}, { strict: false, timestamps: true });

export const NoteSchema = new Schema({
    id: { type: String, unique: true, index: true }
}, { strict: false, timestamps: true });

// --- Missing Schemas Added ---

export const CancellationSchema = new Schema({
    id: { type: String, unique: true, index: true },
    reason: String,
    plan: String,
    amount: Number,
    orderId: String,
    userId: String,
    userPhone: String,
    name: String,
    phone: String
}, { timestamps: true });

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

export const DowntimePaymentSchema = new Schema({
    id: { type: String, unique: true, index: true }
}, { timestamps: true });

export const DynamicScreenSchema = new Schema({
    id: { type: String, unique: true, index: true },
    title: String,
    html: String,
    url: String,
    isPremiumOnly: Boolean,
    data: [Schema.Types.Mixed], // keeping flexible
    updatedAt: Date
}, { timestamps: true });

export const ListFolderSchema = new Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    isArchive: { type: Boolean, default: false },
    createdBy: String,
    list_count: Number
}, { timestamps: true });

export const PermissionSchema = new Schema({
    id: { type: String, unique: true, index: true },
    role: String,
    pages: [String]
}, { timestamps: true });

