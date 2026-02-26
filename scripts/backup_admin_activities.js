/**
 * backup_admin_activities.js
 * 
 * Exports all admin_activities (subcollections under admin_activities/{adminId}/logs)
 * from Firestore to JSON files in the backups/admin_activities/ folder.
 * 
 * Firestore structure:
 *   admin_activities/{adminId}/logs/{logId} → { method, path, status, timestamp, body, response, ... }
 * 
 * Usage:
 *   node scripts/backup_admin_activities.js
 */

import pkg from 'firebase-admin';
const { firestore } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'admin_activities');
const BATCH_SIZE = 500;

async function backupAdminActivities() {
    try {
        console.log('Starting admin_activities backup...');

        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        // Get all admin documents (top-level collection)
        const adminActivitiesRef = db.collection('admin_activities');
        const adminDocs = await adminActivitiesRef.listDocuments();

        console.log(`Found ${adminDocs.length} admin_activities parent documents`);

        let totalLogs = 0;

        for (const adminDoc of adminDocs) {
            const adminId = adminDoc.id;
            console.log(`\nBacking up activities for admin: ${adminId}`);

            const logsRef = adminDoc.collection('logs');
            let lastDoc = null;
            let batchNumber = 1;
            let adminTotalLogs = 0;
            let hasMore = true;

            while (hasMore) {
                try {
                    // Fetch logs in batches to avoid timeout
                    let query = logsRef.orderBy(firestore.FieldPath.documentId()).limit(BATCH_SIZE);
                    
                    if (lastDoc) {
                        query = query.startAfter(lastDoc);
                    }

                    const logsSnapshot = await query.get();

                    if (logsSnapshot.empty) {
                        if (batchNumber === 1) {
                            console.log(`  No logs found for admin ${adminId}`);
                        }
                        hasMore = false;
                        break;
                    }

                    const logs = [];
                    logsSnapshot.forEach(doc => {
                        const data = doc.data();
                        logs.push({
                            id: doc.id,
                            adminId, // Include adminId for context
                            ...data
                        });
                    });

                    adminTotalLogs += logs.length;
                    console.log(`  Batch ${batchNumber}: Found ${logs.length} logs`);

                    // Write batch to file
                    const timestamp = Date.now();
                    const filename = `batch_${timestamp}_${adminId}_${batchNumber}.json`;
                    const filepath = path.join(BACKUP_DIR, filename);

                    fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
                    console.log(`  ✓ Saved to ${filename}`);

                    // Check if there are more logs
                    if (logsSnapshot.size < BATCH_SIZE) {
                        hasMore = false;
                    } else {
                        lastDoc = logsSnapshot.docs[logsSnapshot.docs.length - 1];
                        batchNumber++;
                    }

                } catch (error) {
                    console.error(`  ❌ Error fetching batch ${batchNumber} for admin ${adminId}:`, error.message);
                    hasMore = false;
                }
            }

            if (adminTotalLogs > 0) {
                console.log(`  ✓ Total logs for ${adminId}: ${adminTotalLogs}`);
                totalLogs += adminTotalLogs;
            }
        }

        console.log(`\n✅ Backup complete!`);
        console.log(`Total admin_activities documents: ${adminDocs.length}`);
        console.log(`Total activity logs: ${totalLogs}`);
        console.log(`Backup location: ${BACKUP_DIR}`);

    } catch (error) {
        console.error('❌ Backup failed:', error);
        throw error;
    }
}

// Run backup
backupAdminActivities()
    .then(() => {
        console.log('\n✓ Process completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✗ Process failed:', error);
        process.exit(1);
    });
