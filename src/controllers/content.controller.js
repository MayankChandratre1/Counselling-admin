import ContentService from '../services/content.service.js';

const ContentController = {
    async getLandingPage(req, res) {
        try {
            const page = await ContentService.getLandingPage();
            res.status(200).json(page);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async editLandingPage(req, res) {
        try {
            const page = await ContentService.editLandingPage(req.body);
            res.status(200).json(page);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getHomePage(req, res) {
        try {
            const page = await ContentService.getHomePage();
            res.status(200).json(page);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updateHomePage(req, res) {
        try {
            const page = await ContentService.updateHomePage(req.body);
            res.status(200).json(page);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getContactData(req, res) {
        try {
            const contact = await ContentService.getContactData();
            res.status(200).json(contact);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updateContactData(req, res) {
        try {
            const contact = await ContentService.updateContactData(req.body, req.admin?.email);
            res.status(200).json(contact);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getDynamicPages(req, res) {
        try {
            const dynamicPages = await ContentService.getDynamicPages();
            res.status(200).json(dynamicPages);
        } catch (error) {
            console.error('Get dynamic pages error:', error);
            res.status(400).json({ error: error.message });
        }
    },

    async updateDynamicPages(req, res) {
        try {
            const { data } = req.body;
            if (!data || !Array.isArray(data)) {
                return res.status(400).json({ error: 'Invalid payload: data array required' });
            }
            const result = await ContentService.updateDynamicPages(data);
            res.status(200).json(result);
        } catch (error) {
            console.error('Update dynamic pages error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async getPremiumPlans(req, res) {
        try {
            const plans = await ContentService.getPremiumPlans();
            res.status(200).json(plans);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePremiumPlans(req, res) {
        try {
            const { plans, homeCountdownCardsEnabled } = req.body;
            if (!plans || !Array.isArray(plans)) {
                return res.status(400).json({ error: 'Invalid payload: plans array required' });
            }
            const result = await ContentService.updatePremiumPlans(plans, { homeCountdownCardsEnabled });
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async searchColleges(req, res) {
        try {
            const colleges = await ContentService.searchColleges(req.query);
            res.status(200).json(colleges);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getListFolders(req, res) {
        try {
            const folders = await ContentService.getListFolders();
            res.status(200).json(folders);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async createListFolder(req, res) {
        try {
            const folder = await ContentService.createListFolder(req.body, req.admin);
            res.status(201).json(folder);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getCutoff(req, res) {
        try {
            // Lazy import to avoid circular dependency
            const CollegeService = (await import('../services/college.services.js')).default;
            const collegeService = new CollegeService();
            
            const { collegeIds } = req.body;
            
            if (!collegeIds || !Array.isArray(collegeIds)) {
                return res.status(400).json({ success: false, message: 'collegeIds array is required' });
            }
            
            const cutoffData = await collegeService.getCutoff(collegeIds);
            
            res.json(cutoffData);
        } catch (error) {
            console.error('Controller error getting cutoff:', error);
            res.status(500).json({ error: error.message });
        }
    }
};

export default ContentController;
