import mongoose from 'mongoose';
import {
    LandingPageContactSchema,
    LandingPageHomepageSchema,
    LandingPagePremiumPlansSchema,
    LandingPageReviewsSchema
} from '../../scripts/SchemasV3.js';

// Post-migration, these are separate MongoDB collections.
export const LandingPageContact = mongoose.models.LandingPageContact
    || mongoose.model('LandingPageContact', LandingPageContactSchema, 'landingpagecontacts');

export const LandingPageHomepage = mongoose.models.LandingPageHomepage
    || mongoose.model('LandingPageHomepage', LandingPageHomepageSchema, 'landingpagehomepages');

export const LandingPagePremiumPlans = mongoose.models.LandingPagePremiumPlans
    || mongoose.model('LandingPagePremiumPlans', LandingPagePremiumPlansSchema, 'landingpagepremiumplans');

export const LandingPageReviews = mongoose.models.LandingPageReviews
    || mongoose.model('LandingPageReviews', LandingPageReviewsSchema, 'landingpagereviews');
