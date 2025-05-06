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

export default router;
