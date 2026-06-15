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

    normalizeSectionPayload(payload) {
        if (!payload || typeof payload !== 'object') return payload;
        
        // Handle section-based updates: { section: 'header', data: { title: ..., slogan: ... } }
        if (payload.section && Object.prototype.hasOwnProperty.call(payload, 'data')) {
            const sectionData = payload.data;
            
            // For section updates, only extract the specific fields to update
            // This prevents overwriting the entire document with nested data
            const updateFields = {};
            
            // Map section data to actual fields (flatten if needed)
            for (const [key, value] of Object.entries(sectionData)) {
                updateFields[key] = value;
            }
            
            return updateFields;
        }
        
        // Handle direct updates: { title: ..., slogan: ... }
        return payload;
    }

    async getLandingPage() {
        return this.getHomepage();
    }

    async editLandingPage(payload) {
        const normalized = this.normalizeSectionPayload(payload);
        return this.updateHomepage(normalized);
    }

    async getHomePage() {
        return this.getHomepage();
    }

    async updateHomePage(payload) {
        const normalized = this.normalizeSectionPayload(payload);
        return this.updateHomepage(normalized);
    }

    async getContactData() {
        return this.getContact();
    }

    async updateContactData(payload, adminEmail) {
        const normalized = this.normalizeSectionPayload(payload);
        return this.updateContact(normalized, adminEmail);
    }

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
            const allowedFields = ['address', 'phone', 'whatsapp', 'youtube', 'company'];
            const filteredData = {};
            
            for (const key of Object.keys(data)) {
                if (allowedFields.includes(key)) {
                    filteredData[key] = data[key];
                }
            }
            
            filteredData.updatedAt = new Date();
            
            const updated = await LandingPageContact.findOneAndUpdate(
                { id: 'contact' },
                { $set: filteredData },
                { new: true, upsert: true, lean: true }
            );
            
            this.invalidateCache('contact:*');
            
            return { 
                message: 'Contact updated successfully',
                updated: Object.keys(filteredData),
                timestamp: filteredData.updatedAt
            };
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
            // Filter out fields that shouldn't be updated
            const allowedFields = ['title', 'slogan', 'ctaText', 'videoUrl', 'testimonials', 'features', 'banners', 'events', 'updates', 'recommended_colleges'];
            const filteredData = {};
            
            for (const key of Object.keys(data)) {
                if (allowedFields.includes(key)) {
                    filteredData[key] = data[key];
                }
            }
            
            // Add updatedAt timestamp
            filteredData.updatedAt = new Date();
            
            const updated = await LandingPageHomepage.findOneAndUpdate(
                { id: 'homepage' },
                { $set: filteredData },
                { new: true, upsert: true, lean: true }
            );
            
            this.invalidateCache('homepage');
            
            // Return only the updated fields + confirmation, not the whole doc
            return { 
                message: 'Homepage updated successfully', 
                updated: Object.keys(filteredData),
                timestamp: filteredData.updatedAt
            };
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

    async updatePremiumPlans(plans, options = {}) {
        try {
            const { homeCountdownCardsEnabled } = options;
            // Normalize opensAt timestamps from Firestore format if needed
            const normalizedPlans = plans.map(plan => {
                const normalized = { ...plan };
                
                // Convert Firestore timestamp { _seconds, _nanoseconds } to Date
                if (plan.opensAt && typeof plan.opensAt === 'object' && plan.opensAt._seconds) {
                    normalized.opensAt = new Date(plan.opensAt._seconds * 1000);
                }
                if (plan.countdownEndsAt && typeof plan.countdownEndsAt === 'object' && plan.countdownEndsAt._seconds) {
                    normalized.countdownEndsAt = new Date(plan.countdownEndsAt._seconds * 1000);
                } else if (plan.countdownEndsAt === '' || plan.countdownEndsAt === null) {
                    delete normalized.countdownEndsAt;
                }
                if (!plan.countdownMessage?.trim()) {
                    delete normalized.countdownMessage;
                }

                return normalized;
            });

            const update = { plans: normalizedPlans, updatedAt: new Date() };
            if (homeCountdownCardsEnabled !== undefined) {
                update.homeCountdownCardsEnabled = !!homeCountdownCardsEnabled;
            }
            
            await LandingPagePremiumPlans.findOneAndUpdate(
                { id: 'premiumPlans' },
                { $set: update },
                { new: true, upsert: true, lean: true }
            );
            
            this.invalidateCache('premiumPlans');
            
            return { 
                message: 'Premium plans updated successfully',
                count: normalizedPlans.length,
                timestamp: new Date()
            };
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
            if (!pages || pages.length === 0) {
                return { message: 'No pages to update' };
            }
            
            // Generate unique ID if not present
            const pagesWithIds = pages.map(page => {
                if (!page.id) {
                    page.id = `dynamic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                return page;
            });
            
            const bulkOps = pagesWithIds.map(page => ({
                updateOne: {
                    filter: { id: page.id },
                    update: { $set: { ...page, updatedAt: new Date() } },
                    upsert: true
                }
            }));
            
            const result = await DynamicScreen.bulkWrite(bulkOps);
            this.invalidateCache('dynamicScreens:*');
            
            return { 
                message: 'Dynamic pages updated successfully',
                count: pagesWithIds.length,
                modified: result.modifiedCount,
                upserted: result.upsertedCount
            };
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

    /**
     * Create list folder - delegates to ListService for consistency
     * Import is lazy to avoid circular dependency
     */
    async createListFolder(folderData, admin) {
        try {
            const ListService = (await import('./list.service.js')).default;
            return await ListService.createListFolder(folderData, admin);
        } catch (error) {
            throw new Error('Failed to create list folder: ' + error.message);
        }
    }
}

export default new ContentService();
