#!/usr/bin/env node

/**
 * Migration Script: Populate landingpagehomepages collection
 * 
 * Purpose: Fix empty title/slogan/ctaText/features/testimonials fields in 
 *          landingpagehomepages by migrating data from backup JSON.
 * 
 * Source: backups/landingPage/batch_1771507604440_reviews.json
 * Target: MongoDB collection "landingpagehomepages" (id: "homepage")
 * 
 * Usage:
 *   node migrate_landing_page_content.js --dry-run   # Preview changes
 *   node migrate_landing_page_content.js --apply     # Apply changes to DB
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { LandingPageHomepageSchema } from './SchemasV3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BACKUP_FILE = path.join(__dirname, '..', 'backups', 'landingPage', 'batch_1771507604440_reviews.json');
const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');

// ─────────────────────────────────────────────────────────────────────────────
// Models
// ─────────────────────────────────────────────────────────────────────────────

const LandingPageHomepage = mongoose.model('LandingPageHomepage', LandingPageHomepageSchema, 'landingpagehomepages');

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function normalizeMultilingualField(field) {
  if (!field) return { english: '', marathi: '' };
  if (typeof field === 'string') return { english: field, marathi: '' };
  return {
    english: field.english || '',
    marathi: field.marathi || ''
  };
}

function extractLandingPageData(backupArray) {
  // Find the document with id: "landingPage" (not "homepage")
  const landingDoc = backupArray.find(doc => doc.id === 'landingPage');
  
  if (!landingDoc) {
    console.error('❌ Could not find document with id="landingPage" in backup file');
    return null;
  }

  console.log('✅ Found landingPage document in backup');
  console.log('   Fields present:');
  console.log(`   - title: ${JSON.stringify(landingDoc.title)}`);
  console.log(`   - slogan: ${JSON.stringify(landingDoc.slogan)}`);
  console.log(`   - ctaText: ${JSON.stringify(landingDoc.ctaText)}`);
  console.log(`   - videoUrl: ${landingDoc.videoUrl || '(empty)'}`);
  console.log(`   - features: ${landingDoc.features?.length || 0} items`);
  console.log(`   - testimonials: ${landingDoc.testimonials?.length || 0} items`);

  return {
    title: normalizeMultilingualField(landingDoc.title),
    slogan: normalizeMultilingualField(landingDoc.slogan),
    ctaText: normalizeMultilingualField(landingDoc.ctaText),
    videoUrl: landingDoc.videoUrl || '',
    features: (landingDoc.features || []).map(f => normalizeMultilingualField(f)),
    testimonials: (landingDoc.testimonials || []).map(t => ({
      name: t.name || '',
      designation: t.designation || '',
      feedback: t.feedback || ''
    }))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Migration Logic
// ─────────────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Landing Page Content Migration                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (!DRY_RUN && !APPLY) {
    console.error('❌ Error: Must specify --dry-run or --apply');
    console.log('\nUsage:');
    console.log('  node migrate_landing_page_content.js --dry-run   # Preview changes');
    console.log('  node migrate_landing_page_content.js --apply     # Apply to database\n');
    process.exit(1);
  }

  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '✅ APPLY (will modify DB)'}\n`);

  // ─── Step 1: Load backup file ───
  console.log('📂 Loading backup file...');
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`❌ Backup file not found: ${BACKUP_FILE}`);
    process.exit(1);
  }

  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const backupArray = JSON.parse(backupContent);
  console.log(`   Loaded ${backupArray.length} documents from backup\n`);

  // ─── Step 2: Extract landing page data ───
  console.log('🔍 Extracting landing page content...');
  const contentToMigrate = extractLandingPageData(backupArray);
  
  if (!contentToMigrate) {
    console.error('❌ Failed to extract landing page content');
    process.exit(1);
  }
  console.log('');

  // ─── Step 3: Connect to MongoDB ───
  console.log('🔌 Connecting to MongoDB...');
  const MONGO_URI = process.env.MONGO_URI_NEW || process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI or MONGO_URI_NEW not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('   ✅ Connected\n');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }

  // ─── Step 4: Check current state ───
  console.log('📊 Checking current database state...');
  const currentDoc = await LandingPageHomepage.findOne({ id: 'homepage' }).lean();
  
  if (!currentDoc) {
    console.log('   ⚠️  No document found with id="homepage"');
    console.log('   Will create new document\n');
  } else {
    console.log('   ✅ Document found');
    console.log('   Current state:');
    console.log(`      - title: ${JSON.stringify(currentDoc.title)}`);
    console.log(`      - slogan: ${JSON.stringify(currentDoc.slogan)}`);
    console.log(`      - ctaText: ${JSON.stringify(currentDoc.ctaText)}`);
    console.log(`      - videoUrl: ${currentDoc.videoUrl || '(empty)'}`);
    console.log(`      - features: ${currentDoc.features?.length || 0} items`);
    console.log(`      - testimonials: ${currentDoc.testimonials?.length || 0} items\n`);
  }

  // ─── Step 5: Preview/Apply changes ───
  console.log('🔄 Changes to apply:');
  console.log(`   title:        ${JSON.stringify(contentToMigrate.title)}`);
  console.log(`   slogan:       ${JSON.stringify(contentToMigrate.slogan)}`);
  console.log(`   ctaText:      ${JSON.stringify(contentToMigrate.ctaText)}`);
  console.log(`   videoUrl:     ${contentToMigrate.videoUrl}`);
  console.log(`   features:     ${contentToMigrate.features.length} items`);
  console.log(`   testimonials: ${contentToMigrate.testimonials.length} items\n`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No changes made to database');
    console.log('   Run with --apply to persist these changes\n');
  } else {
    console.log('✍️  Applying changes to database...');
    
    try {
      const result = await LandingPageHomepage.findOneAndUpdate(
        { id: 'homepage' },
        {
          $set: {
            title: contentToMigrate.title,
            slogan: contentToMigrate.slogan,
            ctaText: contentToMigrate.ctaText,
            videoUrl: contentToMigrate.videoUrl,
            features: contentToMigrate.features,
            testimonials: contentToMigrate.testimonials,
            updatedAt: new Date()
          }
        },
        { 
          new: true, 
          upsert: true,
          runValidators: true
        }
      );

      console.log('   ✅ Successfully updated landingpagehomepages collection');
      console.log(`   Document ID: ${result._id}`);
      console.log(`   Updated at: ${result.updatedAt}\n`);

      // ─── Step 6: Verify ───
      console.log('🔍 Verifying update...');
      const verifyDoc = await LandingPageHomepage.findOne({ id: 'homepage' }).lean();
      
      const checks = [
        { name: 'title.english', value: verifyDoc.title?.english, expected: contentToMigrate.title.english },
        { name: 'title.marathi', value: verifyDoc.title?.marathi, expected: contentToMigrate.title.marathi },
        { name: 'slogan.english', value: verifyDoc.slogan?.english, expected: contentToMigrate.slogan.english },
        { name: 'videoUrl', value: verifyDoc.videoUrl, expected: contentToMigrate.videoUrl },
        { name: 'features count', value: verifyDoc.features?.length, expected: contentToMigrate.features.length },
        { name: 'testimonials count', value: verifyDoc.testimonials?.length, expected: contentToMigrate.testimonials.length }
      ];

      let allPassed = true;
      for (const check of checks) {
        const passed = check.value === check.expected;
        console.log(`   ${passed ? '✅' : '❌'} ${check.name}: ${passed ? 'OK' : `expected ${check.expected}, got ${check.value}`}`);
        if (!passed) allPassed = false;
      }

      if (allPassed) {
        console.log('\n✅ Migration completed successfully!\n');
      } else {
        console.log('\n⚠️  Migration completed with warnings - some fields may need manual review\n');
      }

    } catch (error) {
      console.error('❌ Update failed:', error.message);
      console.error(error.stack);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute
// ─────────────────────────────────────────────────────────────────────────────

migrate().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
