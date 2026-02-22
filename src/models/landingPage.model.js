import mongoose from 'mongoose';
import {
    LandingPageContactSchema,
    LandingPageHomepageSchema,
    LandingPagePremiumPlansSchema,
    LandingPageReviewsSchema
} from '../../scripts/SchemasV3.js';

// The `landingPage` Firestore collection stored 4 different documents,
// each distinguished by their `id` field. All map to the same MongoDB collection.
export const LandingPageContact = mongoose.models.LandingPageContact
    || mongoose.model('LandingPageContact', LandingPageContactSchema, 'landingPage');

export const LandingPageHomepage = mongoose.models.LandingPageHomepage
    || mongoose.model('LandingPageHomepage', LandingPageHomepageSchema, 'landingPage');

export const LandingPagePremiumPlans = mongoose.models.landingpagepremiumplans
    || mongoose.model('landingpagepremiumplans', LandingPagePremiumPlansSchema, 'landingpagepremiumplans');

export const LandingPageReviews = mongoose.models.LandingPageReviews
    || mongoose.model('LandingPageReviews', LandingPageReviewsSchema, 'landingPage');
