import CollegeService from '../services/college.services.js';
import { FeatureFlag, SUPPORTED_FLAGS } from '../models/featureFlag.model.js';
import { BRANCH_BUCKETS } from '../data/branchBuckets.js';

class CollegeController {
    constructor() {
        this.collegeService = new CollegeService();
    }

    async getColleges(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const lastDocId = req.query.lastDocId;
            
            const result = await this.collegeService.getAllColleges(page, limit, lastDocId);
            
            res.json(result);
        } catch (error) {
            console.error('Controller error getting colleges:', error);
            res.status(500).json({ success: false, message: 'Error retrieving colleges', error: error.message });
        }
    }

    async getCollegeById(req, res) {
        try {
            const { id } = req.params;
            const college = await this.collegeService.getCollegeById(id);
            
            res.json({ success: true, college });
        } catch (error) {
            console.error('Controller error getting college by ID:', error);
            
            if (error.message === 'College not found') {
                return res.status(404).json({ success: false, message: 'College not found' });
            }
            
            res.status(500).json({ success: false, message: 'Error retrieving college', error: error.message });
        }
    }

    async searchColleges(req, res) {
        try {
            const filters = {
                instituteName: req.query.instituteName,
                instituteCode: req.query.instituteCode,
                city: req.query.city,
                status: req.query.status,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 5,
                cities: req.query.cities,
            };

            console.log('Searching colleges with filters:', req.query);
            
            
            const result = await this.collegeService.searchColleges(filters);
            
            res.json(result);
        } catch (error) {
            console.error('Controller error searching colleges:', error);
            res.status(500).json({ success: false, message: 'Error searching colleges', error: error.message });
        }
    }

    
    async searchFilteredColleges(req, res) {
        try {
            const {filters} = req.body;
            
            const result = await this.collegeService.searchFilteredColleges(filters);
            
            res.json(result);
        } catch (error) {
            console.error('Controller error searching colleges:', error);
            res.status(500).json({ success: false, message: 'Error searching colleges', error: error.message });
        }
    }

    async createCollege(req, res) {
        try {
            const collegeData = req.body;
            
            if (!collegeData.instituteCode || !collegeData.instituteName) {
                return res.status(400).json({ success: false, message: 'College Code and name are required' });
            }
            collegeData.id = collegeData.instituteCode.toString();
            
            const newCollege = await this.collegeService.createCollege(collegeData);
            
            res.status(201).json({ success: true, message: 'College created successfully', college: newCollege });
        } catch (error) {
            console.error('Controller error creating college:', error);
            
            if (error.message === 'College with this ID already exists') {
                return res.status(409).json({ success: false, message: 'College with this ID already exists' });
            }
            
            res.status(500).json({ success: false, message: 'Error creating college', error: error.message });
        }
    }

    async updateCollege(req, res) {
        try {
            const { id } = req.params;
            const updatedData = req.body;
            
            const updatedCollege = await this.collegeService.updateCollege(id, updatedData);
            
            res.json({ success: true, message: 'College updated successfully', college: updatedCollege });
        } catch (error) {
            console.error('Controller error updating college:', error);
            
            if (error.message === 'College not found') {
                return res.status(404).json({ success: false, message: 'College not found' });
            }
            
            res.status(500).json({ success: false, message: 'Error updating college', error: error.message });
        }
    }

    async deleteCollege(req, res) {
        try {
            const { id } = req.params;
            
            await this.collegeService.deleteCollege(id);
            
            res.json({ success: true, message: 'College deleted successfully' });
        } catch (error) {
            console.error('Controller error deleting college:', error);
            
            if (error.message === 'College not found') {
                return res.status(404).json({ success: false, message: 'College not found' });
            }
            
            res.status(500).json({ success: false, message: 'Error deleting college', error: error.message });
        }
    }

    async getCutoff(req, res) {
        try {
            const { collegeIds } = req.body;
            
            if (!collegeIds || !Array.isArray(collegeIds)) {
                return res.status(400).json({ success: false, message: 'collegeIds array is required' });
            }
            
            const cutoffData = await this.collegeService.getCutoff(collegeIds);
            
            res.json({ success: true, data: cutoffData });
        } catch (error) {
            console.error('Controller error getting cutoff:', error);
            res.status(500).json({ success: false, message: 'Error retrieving cutoff data', error: error.message });
        }
    }

    /**
     * Public read of feature flags so the mobile app can decide whether to
     * surface gated screens (e.g. College Range). Always returns every supported
     * flag, defaulting to `enabled: false` if not yet set in the DB.
     */
    async getFeatureFlagsPublic(req, res) {
        try {
            const docs = await FeatureFlag.find({
                key: { $in: SUPPORTED_FLAGS.map((f) => f.key) }
            }).lean();
            const byKey = docs.reduce((acc, d) => ({ ...acc, [d.key]: d }), {});
            const flags = SUPPORTED_FLAGS.reduce((acc, meta) => {
                acc[meta.key] = !!byKey[meta.key]?.enabled;
                return acc;
            }, {});
            res.json({ success: true, flags });
        } catch (error) {
            console.error('Public feature flags error:', error);
            res.status(500).json({ success: false, flags: {} });
        }
    }

    /**
     * College Range — list buckets the dropdown should render. Mobile keeps a
     * mirror copy too, but exposing this lets us evolve the bucket list without
     * forcing a client-side update.
     */
    async getBranchBuckets(req, res) {
        try {
            res.json({
                success: true,
                buckets: BRANCH_BUCKETS.map(({ key, label }) => ({ key, label }))
            });
        } catch (error) {
            console.error('Branch buckets error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * College Range — body: { category, gender, branchKey, year? }
     * Returns rows of { collegeName, branchName, percentile, rank, ... } for
     * the selected filters, sorted by percentile desc.
     */
    async getCollegeRange(req, res) {
        try {
            const { category, gender, branchKey, year } = req.body || {};

            if (!category || !branchKey) {
                return res.status(400).json({
                    success: false,
                    message: 'category and branchKey are required'
                });
            }

            const rows = await this.collegeService.getCollegeRange({
                category,
                gender,
                branchKey,
                year: year ? Number(year) : 2025
            });

            res.json({
                success: true,
                count: rows.length,
                year: year ? Number(year) : 2025,
                rows
            });
        } catch (error) {
            console.error('Controller error getting college range:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching college range',
                error: error.message
            });
        }
    }
}

// Create instance of controller
const collegeController = new CollegeController();

// Export controller methods individually
export default {
    getColleges: collegeController.getColleges.bind(collegeController),
    getCollegeById: collegeController.getCollegeById.bind(collegeController),
    searchColleges: collegeController.searchColleges.bind(collegeController),
    searchFilteredColleges: collegeController.searchFilteredColleges.bind(collegeController),
    createCollege: collegeController.createCollege.bind(collegeController),
    updateCollege: collegeController.updateCollege.bind(collegeController),
    deleteCollege: collegeController.deleteCollege.bind(collegeController),
    getCutoff: collegeController.getCutoff.bind(collegeController),
    getFeatureFlagsPublic: collegeController.getFeatureFlagsPublic.bind(collegeController),
    getBranchBuckets: collegeController.getBranchBuckets.bind(collegeController),
    getCollegeRange: collegeController.getCollegeRange.bind(collegeController)
};
