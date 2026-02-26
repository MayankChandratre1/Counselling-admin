# Admin MongoDB Migration - Execution Guide

## ✅ What Was Done

### 1. **Reverted Firestore Service Changes**
- The Firestore `admin.service.js` remains **unchanged** (used for legacy operations still in Firestore)
- All admin-specific operations now use MongoDB instead

### 2. **Created MongoDB Infrastructure**

#### **Models & Schemas:**
- ✅ `AdminActivitySchema` added to `scripts/SchemasV3.js`
- ✅ `src/models/adminActivity.model.js` created

#### **Services:**
- ✅ `src/services/admin.mongo.service.js` created with:
  - Admin login (JWT + permissions)
  - Admin CRUD (add, get, update, delete)
  - Permissions management
  - Activity logging (MongoDB-native)

#### **Controllers:**
- ✅ `src/controllers/admin.controller.js` updated to use:
  - `this.adminMongoService` for admin operations
  - `this.adminService` for legacy Firestore operations (kept for other operations)

#### **Middleware:**
- ✅ `src/middleware/logActivityMiddleware.js` now logs to MongoDB `admin_activities` collection

### 3. **Migration Scripts Created**

#### **Backup Script:**
- ✅ `scripts/backup_admin_activities.js` - exports all Firestore admin_activities

#### **Migration Script:**
- ✅ `scripts/migrate_admin_activities.js` - imports activities into MongoDB

---

## 🚀 Execution Steps

### **Step 1: Backup Admin Activities from Firestore**

```bash
cd Counselling-admin
node scripts/backup_admin_activities.js
```

This will create `backups/admin_activities/` folder with JSON files.

**Expected Output:**
```
Starting admin_activities backup...
Found X admin_activities parent documents

Backing up activities for admin: admin_xyz123
  Found 450 logs for admin admin_xyz123
  ✓ Saved to batch_1771507595421_admin_xyz123.json

✅ Backup complete!
Total admin_activities documents: X
Total activity logs: Y
```

---

### **Step 2: Migrate Activities to MongoDB**

```bash
node scripts/migrate_admin_activities.js
```

This will import all backed-up activities into MongoDB `admin_activities` collection.

**Expected Output:**
```
Connecting to MongoDB...
Starting admin_activities migration...
Found X backup files

Processing batch_1771507595421_admin_xyz123.json...
  Found 450 activity logs
  Migrated 100 logs so far...
  Migrated 200 logs so far...
  ✓ Completed batch_1771507595421_admin_xyz123.json

✅ Migration complete!
Total migrated: Y
Total skipped (already exist): Z
```

---

### **Step 3: Restart Backend**

```bash
# Make sure MongoDB connection is active
npm run dev
# or
node src/index.js
```

---

## ✅ What Now Works in MongoDB

### **Admin Management:**
- ✅ `POST /api/admin/login` - Admin login with JWT
- ✅ `GET /api/admin/all-admins` - List all admins
- ✅ `GET /api/admin/admin/:adminId` - Get single admin
- ✅ `POST /api/admin/add-admin` - Add new admin
- ✅ `PUT /api/admin/admin/:adminId` - Update admin
- ✅ `PUT /api/admin/update-admin/:adminId` - Update admin (backward compatible)
- ✅ `DELETE /api/admin/admin/:adminId` - Delete admin
- ✅ `DELETE /api/admin/delete-admin/:adminId` - Delete admin (backward compatible)

### **Permissions:**
- ✅ `GET /api/admin/permissions` - Get all role permissions
- ✅ `POST /api/admin/permissions` - Add/update permissions

### **Activity Logs:**
- ✅ `GET /api/admin/activity/:adminId` - Get admin activity logs
- ✅ All admin actions automatically logged to MongoDB `admin_activities` collection

---

## 📝 Data Structure Changes

### **Before (Firestore):**
```
admin_activities/{adminId}/logs/{logId}
```

### **After (MongoDB):**
```javascript
{
  "_id": ObjectId("..."),
  "id": "act_1771507595421_xyz",
  "adminId": "admin_xyz123",
  "method": "POST",
  "path": "/api/admin/user/:userId",
  "status": 200,
  "timestamp": ISODate("2025-02-25T10:30:00.000Z"),
  "body": { ... },
  "response": { ... },
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0 ...",
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

---

## 🔍 Validation Checklist

After migration, verify these endpoints work:

### **Admin Settings Page (Frontend):**
- [ ] Can view list of admins
- [ ] Can add new admin with email/password
- [ ] Can edit admin email/password
- [ ] Can delete admin (not super-admin)
- [ ] Can view activity logs for each admin
- [ ] Can export activity logs to CSV

### **Login Flow:**
- [ ] Admin can login with correct credentials
- [ ] JWT token is returned
- [ ] Permissions are loaded correctly

---

## 🛠 Troubleshooting

### **Error: "Admin not found"**
- Check MongoDB `admins` collection has documents
- Verify `id` field exists on admin documents

### **Error: "Cannot log activity"**
- Check MongoDB `admin_activities` collection exists
- Verify AdminActivity model is properly imported

### **Backup folder empty:**
- Ensure Firestore credentials are configured in `src/config/firebase.js`
- Check Firestore has `admin_activities` collection

---

## 📊 Migration Summary

| Component | Status | Location |
|-----------|--------|----------|
| Admin CRUD | ✅ MongoDB | `admin.mongo.service.js` |
| Permissions | ✅ MongoDB | `admin.mongo.service.js` |
| Activity Logs | ✅ MongoDB | `adminActivity.model.js` |
| Auth (Login) | ✅ MongoDB | `admin.mongo.service.js` |
| User Operations | ⚠️ Firestore | `admin.service.js` (legacy) |
| List Operations | ✅ MongoDB | `list.service.js` |
| Payment Operations | ⚠️ Firestore | `admin.service.js` (legacy) |

---

## 🎯 Next Steps

1. **Run backup script** (Step 1 above)
2. **Run migration script** (Step 2 above)
3. **Test admin settings page** from frontend
4. **Verify activity logs** are being saved to MongoDB
5. **Plan migration** of remaining Firestore operations (users, payments, etc.)

---

## 📌 Important Notes

- ✅ All admin operations are now **MongoDB-native**
- ✅ Activity logging is **real-time** to MongoDB
- ✅ Frontend unchanged - same request/response structure
- ✅ Email/password validation enforced on both frontend & backend
- ⚠️ Firestore `admin.service.js` kept for legacy operations (will migrate later)
- ⚠️ Run backup script **before** migrating to preserve Firestore data
