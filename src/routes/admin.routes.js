import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import authorize from '../middleware/authorizeMiddleware.js';
import cacheMiddleware from '../middleware/cacheMiddleware.js';

const router = express.Router();

// ─── Admin Management Routes ──────────────────────────────────────────────────

// Get all admins
router.get('/all-admins', authorize(['super-admin']), AdminController.getAllAdmins);

// Get single admin
router.get('/admin/:adminId', authorize(['super-admin']), AdminController.getAdmin);

// Add new admin
router.post('/add-admin', authorize(['super-admin']), AdminController.addAdmin);

// Update admin
router.put('/admin/:adminId', authorize(['super-admin']), AdminController.updateAdmin);

// Delete admin
router.delete('/admin/:adminId', authorize(['super-admin']), AdminController.deleteAdmin);

// ─── Permissions Routes ───────────────────────────────────────────────────────

// Get all permissions
router.get('/permissions', authorize(['super-admin']), AdminController.getPermissions);

// Add or update permissions
router.post('/permissions', authorize(['super-admin']), AdminController.addOrUpdatePermissions);

// ─── Activity Logs Routes ─────────────────────────────────────────────────────

// Get activity logs for specific admin
router.get('/activity/:adminId', authorize(['super-admin', 'admin']), AdminController.getActivityLogs);

// ─── Notes Routes ─────────────────────────────────────────────────────────────

router.post('/add-note/:userId', AdminController.addNote);
router.get('/get-notes/:userId', cacheMiddleware('notes', 300), AdminController.getNotes);

export default router;
