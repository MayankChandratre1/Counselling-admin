import CollegeService from '../services/college.services.js';

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
                limit: parseInt(req.query.limit) || 5
            };
            
            const result = await this.collegeService.searchColleges(filters);
            
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
}

// Create instance of controller
const collegeController = new CollegeController();

// Export controller methods individually
export default {
    getColleges: collegeController.getColleges.bind(collegeController),
    getCollegeById: collegeController.getCollegeById.bind(collegeController),
    searchColleges: collegeController.searchColleges.bind(collegeController),
    createCollege: collegeController.createCollege.bind(collegeController),
    updateCollege: collegeController.updateCollege.bind(collegeController),
    deleteCollege: collegeController.deleteCollege.bind(collegeController)
};
