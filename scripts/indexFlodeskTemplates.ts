#!/usr/bin/env ts-node

/**
 * Flodesk Templates Indexing Script
 *
 * This script processes all Flodesk email templates and indexes them into Qdrant:
 * 1. Reads all template images from flodesk_templates/
 * 2. Uploads each template to Cloudflare R2
 * 3. Analyzes design using GPT-4 Vision
 * 4. Generates embeddings using OpenAI
 * 5. Stores in Qdrant vector database for similarity search
 *
 * Usage:
 *   npm run ts-node scripts/indexFlodeskTemplates.ts
 *   or
 *   ts-node scripts/indexFlodeskTemplates.ts
 *
 * Requirements:
 * - .env file with QDRANT_URL, QDRANT_API_KEY, OPENAI_API_KEY
 * - flodesk_templates/ directory with template images
 */

import dotenv from 'dotenv';
import path from 'path';
import templateLibrary from '../src/services/templateLibrary';
import qdrantService from '../src/lib/qdrant';

// Load environment variables
dotenv.config();

/**
 * Main indexing function
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Flodesk Templates Indexing Script                  ║');
  console.log('║   Vision-RAG Template Inspiration System             ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Step 1: Check configuration
  console.log('📋 Checking configuration...\n');

  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
    console.error('❌ Missing Qdrant configuration');
    console.error('   Please set QDRANT_URL and QDRANT_API_KEY in .env file');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Missing OpenAI API key');
    console.error('   Please set OPENAI_API_KEY in .env file');
    console.error('   Required for vision analysis and embeddings');
    process.exit(1);
  }

  console.log('✅ Configuration valid\n');

  // Step 2: Check if Qdrant is accessible
  console.log('🔌 Testing Qdrant connection...\n');

  if (!qdrantService.isAvailable()) {
    console.error('❌ Qdrant service not available');
    console.error('   Check your QDRANT_URL and QDRANT_API_KEY');
    process.exit(1);
  }

  console.log('✅ Qdrant connection successful\n');

  // Step 3: Check if templates directory exists
  console.log('📁 Checking templates directory...\n');

  try {
    const templateFiles = await templateLibrary.getAllTemplateFiles();
    console.log(`✅ Found ${templateFiles.length} template files\n`);

    if (templateFiles.length === 0) {
      console.error('❌ No template files found in flodesk_templates/');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Failed to access templates directory:', error.message);
    process.exit(1);
  }

  // Step 4: Ask for confirmation
  console.log('⚠️  This script will:');
  console.log('   • Analyze all templates using GPT-4 Vision (costs API credits)');
  console.log('   • Generate embeddings using OpenAI (costs API credits)');
  console.log('   • Upload templates to R2 storage');
  console.log('   • Store data in Qdrant vector database');
  console.log('');

  // Check if already indexed
  try {
    const stats = await templateLibrary.getStatistics();
    if (stats.total_templates > 0) {
      console.log(`⚠️  Warning: Found ${stats.total_templates} already indexed templates`);
      console.log('   This will add/update templates in the existing collection\n');
    }
  } catch (error) {
    // Collection doesn't exist yet, that's fine
  }

  // Step 5: Start indexing
  console.log('🚀 Starting indexing process...\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  try {
    const result = await templateLibrary.indexAllTemplates((completed, total) => {
      const percentage = Math.round((completed / total) * 100);
      console.log(`\n📊 Progress: ${completed}/${total} (${percentage}%)\n`);
    });

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('\n🎉 Indexing Complete!\n');
    console.log(`✅ Successfully indexed: ${result.success} templates`);
    if (result.failed > 0) {
      console.log(`❌ Failed: ${result.failed} templates`);
    }
    console.log(`⏱️  Total time: ${duration} minutes\n`);

    // Show statistics
    const stats = await templateLibrary.getStatistics();
    console.log('📊 Collection Statistics:');
    console.log(`   Total templates in Qdrant: ${stats.total_templates}`);
    console.log('');

    console.log('✨ Templates are now ready for use!');
    console.log('   The system will automatically use these templates for inspiration');
    console.log('   when generating new emails.\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Indexing failed:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error: Error) => {
  console.error('\n❌ Unhandled error:', error.message);
  console.error(error.stack);
  process.exit(1);
});

// Run main function
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
