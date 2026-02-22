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
            const page = await ContentService.editLandingPage(req.body.data);
            res.status(200).json(page);
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

    async getPremiumPlans(req, res) {
        try {
            const plans = await ContentService.getPremiumPlans();
            res.status(200).json(plans);
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
    }
};

export default ContentController;
