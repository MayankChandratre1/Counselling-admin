/**
 * Print collection-wise storage usage for the MongoDB database used by Counselling-admin.
 *
 * Usage:
 *   node scripts/db_storage_stats.js
 *   node scripts/db_storage_stats.js --json
 *
 * Requires MONGO_URI_NEW or MONGO_URI in Counselling-admin/.env
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const asJson = process.argv.includes('--json');

function formatBytes(bytes) {
    if (bytes == null || Number.isNaN(bytes)) return '—';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function pad(str, len) {
    return String(str).padEnd(len);
}

async function main() {
    const mongoURI = process.env.MONGO_URI_NEW || process.env.MONGO_URI;
    if (!mongoURI) {
        console.error('Missing MONGO_URI_NEW or MONGO_URI in .env');
        process.exit(1);
    }

    await mongoose.connect(mongoURI);
    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    const collections = await db.listCollections().toArray();
    const stats = [];

    for (const { name } of collections) {
        try {
            const collStats = await db.command({ collStats: name });
            stats.push({
                collection: name,
                documents: collStats.count ?? 0,
                storageSize: collStats.storageSize ?? 0,
                totalSize: collStats.totalSize ?? collStats.size ?? 0,
                avgObjSize: collStats.avgObjSize ?? 0,
                indexSize: collStats.totalIndexSize ?? 0,
                indexes: collStats.nindexes ?? 0,
            });
        } catch (err) {
            stats.push({
                collection: name,
                error: err.message,
            });
        }
    }

    stats.sort((a, b) => (b.storageSize || 0) - (a.storageSize || 0));

    const totals = stats.reduce(
        (acc, row) => {
            if (row.error) return acc;
            acc.documents += row.documents;
            acc.storageSize += row.storageSize;
            acc.totalSize += row.totalSize;
            acc.indexSize += row.indexSize;
            return acc;
        },
        { documents: 0, storageSize: 0, totalSize: 0, indexSize: 0 }
    );

    if (asJson) {
        console.log(JSON.stringify({ database: dbName, collections: stats, totals }, null, 2));
    } else {
        console.log(`\nMongoDB storage by collection — database: ${dbName}\n`);
        console.log(
            [
                pad('Collection', 36),
                pad('Docs', 10),
                pad('Storage', 12),
                pad('Data', 12),
                pad('Indexes', 12),
                pad('#Idx', 6),
                'Avg doc',
            ].join(' ')
        );
        console.log('-'.repeat(100));

        for (const row of stats) {
            if (row.error) {
                console.log(`${pad(row.collection, 36)} ERROR: ${row.error}`);
                continue;
            }
            console.log(
                [
                    pad(row.collection, 36),
                    pad(row.documents.toLocaleString(), 10),
                    pad(formatBytes(row.storageSize), 12),
                    pad(formatBytes(row.totalSize), 12),
                    pad(formatBytes(row.indexSize), 12),
                    pad(row.indexes, 6),
                    formatBytes(row.avgObjSize),
                ].join(' ')
            );
        }

        console.log('-'.repeat(100));
        console.log(
            [
                pad('TOTAL', 36),
                pad(totals.documents.toLocaleString(), 10),
                pad(formatBytes(totals.storageSize), 12),
                pad(formatBytes(totals.totalSize), 12),
                pad(formatBytes(totals.indexSize), 12),
                '',
                '',
            ].join(' ')
        );
        console.log('\nStorage = on-disk allocation (includes free space in WiredTiger blocks).');
        console.log('Data    = uncompressed document size.\n');
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
