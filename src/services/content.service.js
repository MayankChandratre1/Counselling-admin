import {
    LandingPageContact,
    LandingPageHomepage,
    LandingPagePremiumPlans,
    LandingPageReviews
} from '../models/landingPage.model.js';
import { College } from '../models/college.model.js';
import { ListFolder } from '../models/misc.model.js';
import { DynamicScreen } from '../models/misc.model.js';
import cache from '../config/cache.js';

class ContentService {
    invalidateCache(pattern) {
        const cleanPattern = pattern.replace(/\*/g, '');
        const keys = cache.keys();
        const matches = keys.filter(k => k.includes(cleanPattern));
        if (matches.length > 0) cache.del(matches);
    }

    // ── Landing Page: Contact ─────────────────────────────────────────────────

    async getContact() {
        try {
            let doc = await LandingPageContact.findOne({ id: 'contact' }).lean();
            if (!doc) doc = await LandingPageContact.findOne({}).lean();
            return doc;
        } catch (error) {
            throw new Error('Failed to get contact: ' + error.message);
        }
    }

    async updateContact(data, adminEmail) {
        try {
            const updated = await LandingPageContact.findOneAndUpdate(
                { id: 'contact' },
                { $set: { ...data, updatedAt: new Date() } },
                { new: true, upsert: true }
            );
            this.invalidateCache('contact:*');
            return { message: 'Contact updated', data: updated };
        } catch (error) {
            throw new Error('Failed to update contact: ' + error.message);
        }
    }

    // ── Landing Page: Homepage ────────────────────────────────────────────────

    async getHomepage() {
        try {
            const cached = cache.get('homepage');
            if (cached) return cached;
            let doc = await LandingPageHomepage.findOne({ id: 'homepage' }).lean();
            if (!doc) doc = await LandingPageHomepage.findOne({}).lean();
            if (doc) cache.set('homepage', doc, 300);
            return doc;
        } catch (error) {
            throw new Error('Failed to get homepage: ' + error.message);
        }
    }

    async updateHomepage(data) {
        try {
            const updated = await LandingPageHomepage.findOneAndUpdate(
                { id: 'homepage' },
                { $set: data },
                { new: true, upsert: true }
            );
            this.invalidateCache('homepage');
            return { message: 'Homepage updated', data: updated };
        } catch (error) {
            throw new Error('Failed to update homepage: ' + error.message);
        }
    }

    // ── Landing Page: Premium Plans ───────────────────────────────────────────

    async getPremiumPlans() {
        try {
            const cached = cache.get('premiumPlans');
            if (cached) return cached;
            let doc = await LandingPagePremiumPlans.findOne({
                id: { $in: ['premiumPlans', 'premiumplans', 'premium-plans'] }
            }).lean();

            if (!doc) {
                doc = await LandingPagePremiumPlans.findOne({})
                    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
                    .lean();
            }
            if (doc) cache.set('premiumPlans', doc, 300);
            return doc;
        } catch (error) {
            throw new Error('Failed to get premium plans: ' + error.message);
        }
    }

    async updatePremiumPlans(plans) {
        try {
            const updated = await LandingPagePremiumPlans.findOneAndUpdate(
                { id: 'premiumPlans' },
                { $set: { plans } },
                { new: true, upsert: true }
            );
            this.invalidateCache('premiumPlans');
            return { message: 'Premium plans updated', data: updated };
        } catch (error) {
            throw new Error('Failed to update premium plans: ' + error.message);
        }
    }

    // ── Landing Page: Reviews ─────────────────────────────────────────────────

    async getReviews() {
        try {
            let doc = await LandingPageReviews.findOne({ id: 'reviews' }).lean();
            if (!doc) doc = await LandingPageReviews.findOne({}).lean();
            return doc?.data || [];
        } catch (error) {
            throw new Error('Failed to get reviews: ' + error.message);
        }
    }

    async updateReviews(data) {
        try {
            const updated = await LandingPageReviews.findOneAndUpdate(
                { id: 'reviews' },
                { $set: { data } },
                { new: true, upsert: true }
            );
            return { message: 'Reviews updated', data: updated };
        } catch (error) {
            throw new Error('Failed to update reviews: ' + error.message);
        }
    }

    // ── Colleges ──────────────────────────────────────────────────────────────

    /**
     * Search colleges with text + filters.
     * Mirrors admin.service.js searchColleges.
     */
    async searchColleges({ query, city, limit = 20, skip = 0 }) {
        try {
            const filter = {};
            if (query) {
                filter.$or = [
                    { instituteName: { $regex: query, $options: 'i' } },
                    { 'searchIndex.instituteCodeName': { $regex: query, $options: 'i' } },
                    { keywords: { $in: [new RegExp(query, 'i')] } }
                ];
            }
            if (city) filter.city = { $regex: city, $options: 'i' };

            return await College.find(filter).skip(parseInt(skip)).limit(parseInt(limit)).lean();
        } catch (error) {
            throw new Error('Failed to search colleges: ' + error.message);
        }
    }

    // ── Dynamic Pages / Screens ───────────────────────────────────────────────

    async getDynamicPages() {
        try {
            return await DynamicScreen.find().lean();
        } catch (error) {
            throw new Error('Failed to get dynamic pages: ' + error.message);
        }
    }

    /**
     * Bulk-update dynamic screen config.
     * Mirrors admin.service.js updateDynamicPages.
     */
    async updateDynamicPages(pages) {
        try {
            const bulkOps = pages.map(page => ({
                updateOne: {
                    filter: { id: page.id },
                    update: { $set: { ...page, updatedAt: new Date() } },
                    upsert: true
                }
            }));
            if (bulkOps.length === 0) return { message: 'No pages to update' };
            await DynamicScreen.bulkWrite(bulkOps);
            this.invalidateCache('dynamicScreens:*');
            return { message: 'Dynamic pages updated successfully' };
        } catch (error) {
            throw new Error('Failed to update dynamic pages: ' + error.message);
        }
    }

    // ── List Folders (content-side read) ─────────────────────────────────────
    async getListFolders() {
        try {
            return await ListFolder.find().lean();
        } catch (error) {
            throw new Error('Failed to get list folders: ' + error.message);
        }
    }
}

export default new ContentService();
