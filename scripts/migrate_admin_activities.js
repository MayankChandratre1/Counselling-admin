/**
 * migrate_admin_activities.js
 * 
 * Migrates admin_activities from Firestore backup JSON files to MongoDB.
 * 
 * Usage:
 *   node scripts/migrate_admin_activities.js
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdminActivity } from '../src/models/adminActivity.model.js';
import connectDB from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'admin_activities');

async function migrateAdminActivities() {
    try {
        console.log('Connecting to MongoDB...');
        await connectDB();

        console.log('Starting admin_activities migration...');

        if (!fs.existsSync(BACKUP_DIR)) {
            throw new Error(`Backup directory not found: ${BACKUP_DIR}\nPlease run backup_admin_activities.js first!`);
        }

        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
        console.log(`Found ${files.length} backup files`);

        let totalMigrated = 0;
        let totalSkipped = 0;

        for (const file of files) {
            console.log(`\nProcessing ${file}...`);
            const filepath = path.join(BACKUP_DIR, file);
            const rawData = fs.readFileSync(filepath, 'utf8');
            const logs = JSON.parse(rawData);

            if (!Array.isArray(logs) || logs.length === 0) {
                console.log(`  Skipping empty file`);
                continue;
            }

            console.log(`  Found ${logs.length} activity logs`);

            for (const log of logs) {
                try {
                    // Check if already exists
                    const existing = await AdminActivity.findOne({ id: log.id });
                    if (existing) {
                        totalSkipped++;
                        continue;
                    }

                    // Convert timestamp if needed
                    let timestamp = log.timestamp;
                    if (typeof timestamp === 'string') {
                        timestamp = new Date(timestamp);
                    } else if (timestamp?._seconds) {
                        // Firestore Timestamp
                        timestamp = new Date(timestamp._seconds * 1000);
                    }

                    // Create MongoDB document
                    const activityDoc = new AdminActivity({
                        id: log.id,
                        adminId: log.adminId,
                        adminEmail: log.adminEmail,
                        method: log.method,
                        path: log.path,
                        params: log.params,
                        query: log.query,
                        body: log.body,
                        status: log.status,
                        response: log.response,
                        timestamp: timestamp || new Date(),
                        ip: log.ip,
                        userAgent: log.userAgent,
                        createdAt: timestamp || new Date(),
                        updatedAt: timestamp || new Date()
                    });

                    await activityDoc.save();
                    totalMigrated++;

                    if (totalMigrated % 100 === 0) {
                        console.log(`  Migrated ${totalMigrated} logs so far...`);
                    }
                } catch (docError) {
                    console.error(`  Error migrating log ${log.id}:`, docError.message);
                }
            }

            console.log(`  ✓ Completed ${file}`);
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`Total migrated: ${totalMigrated}`);
        console.log(`Total skipped (already exist): ${totalSkipped}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
    }
}

// Run migration
migrateAdminActivities()
    .then(() => {
        console.log('\n✓ Process completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✗ Process failed:', error);
        process.exit(1);
    });
