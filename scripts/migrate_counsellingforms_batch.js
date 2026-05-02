import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import connectDB from '../src/config/database.js';
import { CounsellingForm } from '../src/models/forms.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

function resolveInputPath(argPath) {
    if (!argPath) {
        return path.join(
            __dirname,
            '../backups/counsellingForms/batch_1771507603547_elite-1234567.json'
        );
    }

    return path.isAbsolute(argPath)
        ? argPath
        : path.resolve(process.cwd(), argPath);
}

function normalizeForm(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    if (!raw.id || typeof raw.id !== 'string') {
        return null;
    }

    return {
        id: raw.id,
        lastUpdatedBy: raw.lastUpdatedBy || null,
        steps: Array.isArray(raw.steps) ? raw.steps : [],
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    };
}

async function migrateForms(batchPath) {
    const raw = fs.readFileSync(batchPath, 'utf8');
    const forms = JSON.parse(raw);

    if (!Array.isArray(forms)) {
        throw new Error('Batch JSON must be an array of forms.');
    }

    const stats = {
        total: forms.length,
        prepared: 0,
        skippedInvalid: 0,
        inserted: 0,
        updated: 0,
        failed: 0,
    };

    const operations = [];

    for (const item of forms) {
        const normalized = normalizeForm(item);

        if (!normalized) {
            stats.skippedInvalid += 1;
            continue;
        }

        stats.prepared += 1;
        operations.push({
            updateOne: {
                filter: { id: normalized.id },
                update: {
                    $set: normalized,
                },
                upsert: true,
            },
        });
    }

    if (operations.length === 0) {
        return stats;
    }

    const result = await CounsellingForm.bulkWrite(operations, { ordered: false });

    stats.inserted = result.upsertedCount || 0;
    stats.updated = result.modifiedCount || 0;

    return stats;
}

async function main() {
    const inputArg = process.argv[2];
    const batchPath = resolveInputPath(inputArg);

    if (!fs.existsSync(batchPath)) {
        throw new Error(`Batch file not found: ${batchPath}`);
    }

    console.log('Using batch file:', batchPath);

    await connectDB();

    try {
        const stats = await migrateForms(batchPath);

        console.log('Migration complete.');
        console.log(JSON.stringify(stats, null, 2));
    } finally {
        await CounsellingForm.db.close();
    }
}

main().catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
});
