import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import authorize from '../middleware/authorizeMiddleware.js';
import cacheMiddleware from '../middleware/cacheMiddleware.js';
import { requireSecurityPrivileges } from '../middleware/securityAccessMiddleware.js';

const router = express.Router();

// ─── Admin Management Routes ──────────────────────────────────────────────────

// Get all admins
router.get('/all-admins', requireSecurityPrivileges, AdminController.getAllAdmins);

// Get single admin
router.get('/admin/:adminId', requireSecurityPrivileges, AdminController.getAdmin);

// Add new admin
router.post('/add-admin', requireSecurityPrivileges, AdminController.addAdmin);

// Update admin
router.put('/admin/:adminId', requireSecurityPrivileges, AdminController.updateAdmin);
router.put('/update-admin/:adminId', requireSecurityPrivileges, AdminController.updateAdmin);

// Delete admin
router.delete('/admin/:adminId', requireSecurityPrivileges, AdminController.deleteAdmin);
router.delete('/delete-admin/:adminId', requireSecurityPrivileges, AdminController.deleteAdmin);

// ─── Permissions Routes ───────────────────────────────────────────────────────

// Get all permissions
router.get('/permissions', requireSecurityPrivileges, AdminController.getPermissions);

// Add or update permissions
router.post('/permissions', requireSecurityPrivileges, AdminController.addOrUpdatePermissions);
router.post('/permissions/:role', requireSecurityPrivileges, AdminController.addOrUpdatePermissions);

// ─── Security Operations Routes ───────────────────────────────────────────────

router.get('/security/device-approvals', requireSecurityPrivileges, AdminController.getDeviceApprovals);
router.post('/security/device-approvals/:approvalId/approve', requireSecurityPrivileges, AdminController.approveDevice);
router.post('/security/device-approvals/:approvalId/reject', requireSecurityPrivileges, AdminController.rejectDevice);
router.post('/security/device-approvals/:approvalId/revoke', requireSecurityPrivileges, AdminController.revokeDevice);
router.get('/security/sessions', requireSecurityPrivileges, AdminController.getUserSessions);

// ─── Activity Logs Routes ─────────────────────────────────────────────────────

// Get activity logs for specific admin
router.get('/activity/:adminId', authorize(['super-admin', 'admin']), AdminController.getActivityLogs);

// ─── Notes Routes ─────────────────────────────────────────────────────────────

router.post('/add-note/:userId', AdminController.addNote);
router.get('/get-notes/:userId', cacheMiddleware('notes', 300), AdminController.getNotes);

// ─── Feature Flags Routes ─────────────────────────────────────────────────────

router.get('/feature-flags', requireSecurityPrivileges, AdminController.getFeatureFlags);
router.put('/feature-flags/:key', requireSecurityPrivileges, AdminController.updateFeatureFlag);

export default router;
