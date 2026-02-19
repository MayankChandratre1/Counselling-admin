import mongoose from 'mongoose';

const { Schema } = mongoose;

// Admin Schema
export const AdminSchema = new Schema({
    id: { type: String, unique: true, index: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'super-admin'], default: 'admin' },
    permissions: {
        pages: [String]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Appointment Schema
export const AppointmentSchema = new Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    phone: String,
    reason: String,
    createdAt: { type: Date, default: Date.now }
});

// Cancellation Schema
export const CancellationSchema = new Schema({
    id: { type: String, unique: true, index: true },
    reason: String,
    plan: String,
    amount: Number,
    orderId: String,
    userId: String,
    userPhone: String,
    name: String,
    createdAt: { type: Date, default: Date.now }
});

// College Update Schema
export const CollegeUpdateSchema = new Schema({
    id: { type: String, unique: true, index: true },
    deleted: Boolean,
    date: Date,
    title: String,
    subtitle: String,
    type: String,
    link: String,
    thumbnail: String
});

// College Schema (colleges_v4)
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

export const CollegeSchema = new Schema({
    id: { type: String, unique: true, index: true },
    instituteCode: Number,
    instituteName: String,
    city: String,
    keywords: [String],
    branches: [BranchSchema],
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

// Counselling Form Schema
const FormStepSchema = new Schema({
    number: Number,
    title: String,
    description: String,
    showListButton: Boolean,
    isLocked: Boolean,
    premiumOnly: Boolean,
    isCapSpecific: Boolean,
    cap: Number,
    isVerdict: Boolean,
    isCapQuery: Boolean
}, { _id: false });

export const CounsellingFormSchema = new Schema({
    id: { type: String, unique: true, index: true },
    lastUpdatedBy: String,
    steps: [FormStepSchema],
    updatedAt: Date
});

// Downtime Payment Schema
export const DowntimePaymentSchema = new Schema({
    id: { type: String, unique: true, index: true }
});

// Dynamic Screen Schema
const ScreenDataSchema = new Schema({
    title: String,
    url: String,
    html: String,
    isPremiumOnly: Boolean,
    plan: String
}, { _id: false });

export const DynamicScreenSchema = new Schema({
    id: { type: String, unique: true, index: true },
    title: String,
    html: String,
    url: String,
    isPremiumOnly: Boolean,
    data: [ScreenDataSchema],
    updatedAt: Date
});

// Landing Page Schema
const LandingPageRecommendedCollegeSchema = new Schema({
    id: String,
    instituteCode: String,
    instituteName: String,
    city: String,
    keywords: [String],
    branches: [BranchSchema],
    additionalMetadata: Schema.Types.Mixed
}, { _id: false });

const LandingPageEventSchema = new Schema({
    id: String,
    title: String,
    date: String,
    description: String,
    type: String,
    link: String
}, { _id: false });

const LandingPageUpdateSchema = new Schema({
    id: String,
    title: String,
    subtitle: String,
    type: String,
    date: String,
    link: String,
    thumbnail: String
}, { _id: false });

const LandingPageBannerSchema = new Schema({
    id: String,
    title: String,
    url: String,
    bannerUrl: String,
    isInAppNavigation: Boolean,
    isForCounsellingDashboard: Boolean,
    html: String
}, { _id: false });

const LandingPageTestimonialSchema = new Schema({
    name: String,
    designation: String,
    feedback: String
}, { _id: false });

// Exporting PremiumPlanSchema as requested
export const PremiumPlanSchema = new Schema({
    title: String,
    price: Number,
    opensAt: Date,
    form: String,
    isLocked: Boolean,
    lockedText: String,
    buttonText: String,
    benefits: [String]
}, { _id: false });

export const LandingPageReviewSchema = new Schema({
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

// Using strict: false because this collection holds varied document types (contact, homepage, plans, etc.)
// Documents: 'homepage', 'premiumPlans', 'reviews', 'contact', 'landingPage'
export const LandingPageSchema = new Schema({
    id: { type: String, unique: true, index: true }, // 'homepage', 'premiumPlans', 'landingPage', etc.

    // --- Doc: 'contact' ---
    address: { value: String, link: String },
    company: { name: String },
    youtube: String,
    whatsapp: { groupinvite: String, number: String },
    phone: String,

    // --- Doc: 'homepage' ---
    recommended_colleges: [LandingPageRecommendedCollegeSchema],
    cutoff_video: String,
    events: [LandingPageEventSchema],
    updates: [LandingPageUpdateSchema],
    banners: [LandingPageBannerSchema],
    // slogan (also in landingPage?) - data_samples shows slogan in landingPage doc

    // --- Doc: 'landingPage' ---
    // Contains testimonials, slogan, features, ctaText
    testimonials: [LandingPageTestimonialSchema],
    slogan: { marathi: String, english: String },
    features: [{ marathi: String, english: String, _id: false }],
    ctaText: { marathi: String, english: String },
    videoUrl: String,
    title: Schema.Types.Mixed, // Can be object {marathi, english}

    // --- Doc: 'premiumPlans' ---
    plans: [PremiumPlanSchema],

    // --- Doc: 'reviews' ---
    data: [LandingPageReviewSchema],

    updatedAt: Date
}, { strict: false });

// List Folder Schema
export const ListFolderSchema = new Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    isArchive: { type: Boolean, default: false },
    createdBy: String,
    createdAt: Date,
    updatedAt: Date,
    list_count: Number
});

// List Schema
export const ListCollegeSchema = new Schema({
    id: String,
    instituteCode: String,
    instituteName: String,
    city: String,
    uniqueId: String,
    selectedBranch: String,
    selectedBranchCode: String,
    category: String,
    originalIndex: Number
}, { _id: false });

export const ListSchema = new Schema({
    id: { type: String, unique: true, index: true },
    title: String,
    colleges: [ListCollegeSchema],
    userIds: [String],
    createdAt: Date,
    lastUpdatedBy: String,
    createdBy: String,
    folderId: String,
    updatedAt: Date,
    category: String,
    deletedAt: Date,
    isDeleted: Boolean,
    deleteFolderId: String
});


// Metadata Schema
export const MetadataSchema = new Schema({
    id: { type: String, unique: true, index: true },
    userIdList: [String],
    version: Number,
    enabled: [String],
    total: [String]
}, { strict: false });


// Notes Schema
export const NoteSchema = new Schema({
    id: { type: String, unique: true, index: true }
}, { strict: false });


// Payment Log Schema
export const PaymentLogSchema = new Schema({
    id: { type: String, unique: true, index: true },
    eventType: String,
    data: Schema.Types.Mixed,
    timestamp: Date
});

// Permissions Schema
export const PermissionSchema = new Schema({
    id: { type: String, unique: true, index: true },
    role: String,
    pages: [String]
});


// Registration Form Schema
const RegFieldSchema = new Schema({
    id: String,
    key: String,
    label: String,
    type: String,
    required: Boolean,
    options: [String],
    additionalRemarks: String,
    isLocked: Boolean
}, { _id: false });

const RegStepSchema = new Schema({
    title: String,
    fields: [RegFieldSchema]
}, { _id: false });

export const RegistrationFormSchema = new Schema({
    id: { type: String, unique: true, index: true },
    updatedAt: Date,
    steps: [RegStepSchema]
});


// User Schema
const OrderSchema = new Schema({
    orderId: String,
    amount: Number,
    currency: String,
    receipt: String,
    status: String,
    createdAt: Date,
    paymentStatus: String,
    notes: Schema.Types.Mixed,
    paymentFailureDetails: Schema.Types.Mixed,
    updatedAt: Date,
    paymentId: String,
    paymentDetails: Schema.Types.Mixed,
    orderDetails: Schema.Types.Mixed
}, { _id: false });

export const UserSchema = new Schema({
    id: { type: String, unique: true, index: true },
    phone: { type: String, index: true },
    isPremium: { type: Boolean, default: false },
    createdAt: Date,
    premiumPlan: Schema.Types.Mixed,
    batch: String,
    otpExpiry: Date,
    currentDeviceId: String,
    hasLoggedIn: Boolean,
    firstLogin: Boolean,
    phoneVerified: Boolean,
    otp: String,
    name: String,
    email: String,
    oneSignalId: String,
    currentOrderId: String,
    orderIds: [String],
    orders: [OrderSchema],

    // Nested data from migrated structure
    counsellingData: Schema.Types.Mixed,
    stepsData: Schema.Types.Mixed
});

// User List Schema (Separated to avoid large documents)
export const UserListSchema = new Schema({
    id: { type: String, unique: true, index: true }, // Unique ID for this specific user list entry
    userId: { type: String, required: true, index: true }, // Reference to User's custom ID
    type: { type: String, enum: ['assigned', 'created'], default: 'assigned' }, // To distinguish between assigned lists and user-created lists

    // List Content
    title: String,
    originalListId: String, // If copied from a master list
    colleges: [ListCollegeSchema], // Reusing the ListCollegeSchema structural definition
    createdAt: Date,
    updatedAt: Date,
    isCustomized: Boolean,
    customized: Boolean,
    lastUpdatedBy: String,

    // For 'createdList' or other dynamic fields
    data: Schema.Types.Mixed
});
