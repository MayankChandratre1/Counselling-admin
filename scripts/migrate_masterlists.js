/**
 * migrate_masterlists.js
 * 
 * Migrate lists from Firestore backup JSON to MongoDB `masterlists` collection.
 * Handles `deleteFolderId` field and all list metadata.
 * 
 * Usage:
 *   node scripts/migrate_masterlists.js --dry-run  # See what will be migrated
 *   node scripts/migrate_masterlists.js --apply    # Execute migration
 */

import fs from 'fs/promises';
import path from 'path';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');

if (!dryRun && !apply) {
    console.log('Usage: node scripts/migrate_masterlists.js [--dry-run | --apply]');
    process.exit(1);
}

const backupPath = path.join(__dirname, '../backups/lists/batch_1771507611429_zpHS6VLRualqa6EBzcXQ.json');
const mongoUri = process.env.MONGO_URI_NEW || process.env.MONGO_URI || 'mongodb://localhost:27017/counselling_v2';

let client;

async function connectDB() {
    try {
        client = new MongoClient(mongoUri);
        await client.connect();
        
        // Extract database name from URI (handle query parameters)
        let dbName = 'counselling_v2';
        const match = mongoUri.match(/mongodb(\+srv)?:\/\/[^/]*\/([^?]*)/);
        if (match && match[2]) {
            dbName = match[2];
        }
        
        console.log(`✅ Connected to MongoDB at database: ${dbName}`);
        const db = client.db(dbName);
        if (!db) {
            throw new Error('Failed to get database object');
        }
        return { client, db };
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

async function loadBackupData() {
    try {
        const data = await fs.readFile(backupPath, 'utf8');
        const lists = JSON.parse(data);
        console.log(`✅ Loaded ${lists.length} lists from backup`);
        return lists;
    } catch (error) {
        console.error('❌ Failed to load backup:', error.message);
        process.exit(1);
    }
}

async function ensureArchiveFolder(db) {
    try {
        const existing = await db.collection('listfolders').findOne({ id: 'archive_1' });
        if (!existing) {
            const archive = {
                id: 'archive_1',
                name: 'Archive',
                description: 'Bin for deleted lists',
                createdBy: 'system',
                list_count: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await db.collection('listfolders').insertOne(archive);
            console.log('✅ Created archive_1 folder');
        }
    } catch (error) {
        console.error('❌ Failed to ensure archive folder:', error.message);
    }
}

async function migrateList(db, listData, index) {
    try {
        // Generate ID if not present
        const id = listData.id || `list_${Date.now()}_${index}`;
        
        // Determine folder ID (if in archive, use archive_1)
        const folderId = listData.folderId || null;
        const deleteFolderId = listData.deleteFolderId || null;
        const isDeleted = deleteFolderId === 'archive_1';

        const masterList = {
            id,
            title: listData.title || 'Untitled List',
            description: listData.description || '',
            colleges: listData.colleges || [],
            category: listData.category || 'AI',
            type: listData.type || 'standard',
            folderId,
            userIds: listData.userIds || [],
            createdBy: listData.createdBy || 'migration',
            lastUpdatedBy: listData.lastUpdatedBy || 'migration',
            isDeleted,
            deletedAt: listData.deletedAt ? new Date(listData.deletedAt) : null,
            deleteFolderId,
            createdAt: listData.createdAt ? new Date(listData.createdAt) : new Date(),
            updatedAt: listData.updatedAt ? new Date(listData.updatedAt) : new Date()
        };

        if (apply) {
            await db.collection('masterlists').updateOne(
                { id },
                { $set: masterList },
                { upsert: true }
            );
        }

        return { success: true, id, message: `Migrated list: ${listData.title}` };
    } catch (error) {
        return { success: false, message: `Failed to migrate: ${error.message}` };
    }
}

async function updateFolderCounts(db) {
    try {
        if (!apply) return;

        const folders = await db.collection('listfolders').find({}).toArray();
        
        for (const folder of folders) {
            const listCount = await db.collection('masterlists').countDocuments({
                folderId: folder.id,
                $or: [{ isDeleted: { $ne: true } }, { isDeleted: { $exists: false } }]
            });

            const archivedCount = folder.id === 'archive_1' 
                ? await db.collection('masterlists').countDocuments({ isDeleted: true })
                : 0;

            await db.collection('listfolders').updateOne(
                { id: folder.id },
                { $set: { list_count: listCount + archivedCount } }
            );
        }

        console.log('✅ Updated folder counts');
    } catch (error) {
        console.error('❌ Failed to update folder counts:', error.message);
    }
}

async function main() {
    let connectionResult;
    try {
        console.log(`\n📋 Starting migration in ${dryRun ? 'DRY-RUN' : 'APPLY'} mode\n`);

        connectionResult = await connectDB();
        const { client: mongoClient, db } = connectionResult;
        
        const lists = await loadBackupData();
        
        await ensureArchiveFolder(db);

        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        console.log(`\n🔄 Processing ${lists.length} lists...\n`);

        for (let i = 0; i < lists.length; i++) {
            const result = await migrateList(db, lists[i], i);
            
            if (result.success) {
                successCount++;
                if (i % 50 === 0) {
                    console.log(`  ✅ ${i + 1}/${lists.length} - ${result.message}`);
                }
            } else {
                failureCount++;
                errors.push(result.message);
            }
        }

        console.log(`\n📊 Migration Summary:`);
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ❌ Failed: ${failureCount}`);

        if (errors.length > 0 && errors.length <= 10) {
            console.log(`\n⚠️  Errors:`);
            errors.forEach(err => console.log(`   - ${err}`));
        }

        if (apply) {
            await updateFolderCounts(db);
        }

        console.log(`\n${dryRun ? '✨ DRY-RUN completed' : '✅ MIGRATION COMPLETED'}\n`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connectionResult && connectionResult.client) {
            await connectionResult.client.close();
            console.log('🔌 Disconnected from MongoDB\n');
        }
    }
}

main();
