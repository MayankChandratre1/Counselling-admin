import express from 'express';
import collegeController from '../controllers/college.controller.js';
// import authMiddleware from '../middlewares/auth.middleware.js'; // Uncomment if you need authentication

const router = express.Router();

/**
 * @route   GET /api/colleges
 * @desc    Get all colleges with pagination
 * @access  Public
 */
router.get('/', collegeController.getColleges);

/**
 * @route   GET /api/colleges/search
 * @desc    Search colleges based on filters
 * @access  Public
 */
router.get('/search', collegeController.searchColleges);

/**
 * @route   POST /api/colleges/filtered-search
 * @desc    Search colleges based on filters
 * @access  Public
 */
router.post('/filtered-search', collegeController.searchFilteredColleges);

/**
 * @route   GET /api/colleges/:id
 * @desc    Get a single college by ID
 * @access  Public
 */
router.get('/:id', collegeController.getCollegeById);

/**
 * @route   POST /api/colleges
 * @desc    Create a new college
 * @access  Private
 */
router.post('/', collegeController.createCollege);

/**
 * @route   PUT /api/colleges/:id
 * @desc    Update an existing college
 * @access  Private
 */
router.put('/:id', collegeController.updateCollege);

/**
 * @route   DELETE /api/colleges/:id
 * @desc    Delete a college
 * @access  Private
 */
router.delete('/:id', collegeController.deleteCollege);

/**
 * @route   POST /api/admin/getcutoff
 * @desc    Get cutoff data (branches) for specified college IDs
 * @access  Public
 */
router.post('/getcutoff', collegeController.getCutoff);

/**
 * @route   GET /api/colleges/feature-flags
 * @desc    Public feature flag map (so the mobile app can gate screens)
 * @access  Public
 */
router.get('/feature-flags', collegeController.getFeatureFlagsPublic);

/**
 * @route   GET /api/colleges/branch-buckets
 * @desc    Canonical 12 branch buckets for the College Range dropdown
 * @access  Public
 */
router.get('/branch-buckets', collegeController.getBranchBuckets);

/**
 * @route   POST /api/colleges/college-range
 * @desc    Premium College Range filter — returns colleges matching category,
 *          gender prefix and a canonical branch bucket for the latest year.
 * @access  Public (the mobile app gates via premium flag client-side; no PII here)
 */
router.post('/college-range', collegeController.getCollegeRange);

export default router;
