
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env explicitly from project root (one level up from scripts)
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    console.log(`Loading .env from: ${envPath}`);
    dotenv.config({ path: envPath });
} else {
    console.warn(`Warning: .env file not found at ${envPath}`);
}

// Dynamically import firebase to ensure env vars are loaded first
const { db } = await import('../config/firebase.js');

const SAMPLES_FILE = path.join(__dirname, 'data_samples.json');
const SCHEMAS_FILE = path.join(__dirname, 'inferred_schemas.js');

const SAMPLE_SIZE = 5;

// Helper to determine type
function getType(value) {
    if (value === null) return 'Mixed';
    if (value === undefined) return 'Mixed';

    if (Array.isArray(value)) {
        if (value.length === 0) return '[Mixed]';
        const itemType = getType(value[0]);
        // Check if all items are same type, else Mixed
        const isUniform = value.every(item => getType(item) === itemType);
        return isUniform ? `[${itemType}]` : '[Mixed]';
    }

    if (value instanceof Date) return 'Date';
    // Firestore Timestamp check
    if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
        return 'Date';
    }

    if (typeof value === 'object') {
        // Simple check for object vs specialized types
        if (Object.keys(value).length === 0) return 'Mixed';
        return 'Object';
    }

    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') return 'Number';
    if (typeof value === 'boolean') return 'Boolean';

    return 'Mixed';
}

// Helper to recursively build schema object
function buildSchemaStructure(obj) {
    if (getType(obj) !== 'Object') {
        return getType(obj);
    }

    const schema = {};
    for (const [key, value] of Object.entries(obj)) {
        if (getType(value) === 'Object') {
            schema[key] = buildSchemaStructure(value);
        } else if (getType(value).startsWith('[')) {
            // Handle arrays of objects
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                const mergedItem = {};
                // Merge keys from all items in array to get complete picture
                value.forEach(item => {
                    if (typeof item === 'object') {
                        Object.assign(mergedItem, item);
                    }
                });
                schema[key] = [buildSchemaStructure(mergedItem)];
            } else {
                schema[key] = getType(value);
            }
        } else {
            schema[key] = getType(value);
        }
    }
    return schema;
}

// Function to merge two schema structures (naive merge)
function mergeStructures(s1, s2) {
    if (typeof s1 !== 'object' || typeof s2 !== 'object' || s1 === null || s2 === null) {
        return s1 === s2 ? s1 : 'Mixed';
    }

    const merged = { ...s1 };
    for (const [key, value] of Object.entries(s2)) {
        if (merged[key]) {
            if (typeof merged[key] === 'object' && typeof value === 'object') {
                merged[key] = mergeStructures(merged[key], value);
            } else if (merged[key] !== value) {
                // Conflict, fallback to Mixed or generalize
                merged[key] = 'Mixed';
            }
        } else {
            merged[key] = value;
        }
    }
    return merged;
}

async function inferSchemas() {
    console.log('Starting schema inference...');

    const collections = await db.listCollections();
    const allSamples = {};
    const allSchemas = {};

    console.log(`Found ${collections.length} collections.`);

    for (const collection of collections) {
        const id = collection.id;
        console.log(`Processing collection: ${id}`);

        try {
            const snapshot = await collection.limit(SAMPLE_SIZE).get();
            if (snapshot.empty) {
                console.log(`  No documents found in ${id}`);
                continue;
            }

            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allSamples[id] = docs;

            // Infer schema from docs
            let combinedSchema = {};

            for (const doc of docs) {
                const docStructure = buildSchemaStructure(doc);
                combinedSchema = mergeStructures(combinedSchema, docStructure);
            }

            // Ensure 'id' field exists as String (User Strategy)
            if (!combinedSchema.id) {
                combinedSchema.id = "String";
            }

            allSchemas[id] = combinedSchema;
        } catch (err) {
            console.error(`Error processing collection ${id}:`, err.message);
        }
    }

    // Write Sample Data
    fs.writeFileSync(SAMPLES_FILE, JSON.stringify(allSamples, null, 2));
    console.log(`Saved sample data to ${SAMPLES_FILE}`);

    // Generate output Mongoose Schema code
    let schemaCode = `import mongoose from 'mongoose';\n\n`;

    for (const [colName, schemaStruct] of Object.entries(allSchemas)) {
        // Convert JSON-like structure to Mongoose Schema definition string
        const schemaString = JSON.stringify(schemaStruct, null, 2)
            .replace(/"String"/g, 'String')
            .replace(/"Number"/g, 'Number')
            .replace(/"Boolean"/g, 'Boolean')
            .replace(/"Date"/g, 'Date')
            .replace(/"Mixed"/g, 'mongoose.Schema.Types.Mixed')
            .replace(/"\[String\]"/g, '[String]')
            .replace(/"\[Number\]"/g, '[Number]')
            .replace(/"\[Boolean\]"/g, '[Boolean]')
            .replace(/"\[Date\]"/g, '[Date]')
            .replace(/"\[Mixed\]"/g, '[mongoose.Schema.Types.Mixed]');

        // Capitalize collection name for model
        const modelName = colName.charAt(0).toUpperCase() + colName.slice(1);

        schemaCode += `// Collection: ${colName}\n`;
        schemaCode += `export const ${modelName}Schema = new mongoose.Schema(${schemaString});\n\n`;
    }

    fs.writeFileSync(SCHEMAS_FILE, schemaCode);
    console.log(`Saved inferred schemas to ${SCHEMAS_FILE}`);

    console.log('Done.');
}

console.log('Starting Script...');
inferSchemas().then(() => {
    console.log('Script finished successfully.');
    process.exit(0);
}).catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
