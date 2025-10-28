/**
 * Batch Template Cloning Script
 * Clones all 75 Flodesk templates into AMP4Email HTML
 *
 * Usage:
 *   npm run clone-templates
 *   OR
 *   ts-node scripts/batch-clone-templates.ts
 */

import path from 'path';
import dotenv from 'dotenv';
import templateCloningService from '../src/services/templateCloning';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🎨 FLODESK TEMPLATE BATCH CLONING');
  console.log('=' .repeat(60));

  // Configuration
  const templatesDir = path.join(process.cwd(), 'flodesk_templates');
  const outputDir = path.join(process.cwd(), 'cloned_templates');

  console.log(`\n📂 Templates Directory: ${templatesDir}`);
  console.log(`📂 Output Directory: ${outputDir}`);

  // Verify environment
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ ERROR: OPENAI_API_KEY not found in environment');
    console.error('   Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }

  console.log('\n✅ Environment validated');

  // Progress callback
  const onProgress = (current: number, total: number, template: string) => {
    const percentage = ((current / total) * 100).toFixed(1);
    console.log(`\n📊 Progress: ${current}/${total} (${percentage}%) - ${template}`);
  };

  try {
    // Execute batch cloning
    const summary = await templateCloningService.batchCloneTemplates(
      templatesDir,
      outputDir,
      onProgress
    );

    // Exit with appropriate code
    if (summary.failed_clones > 0) {
      console.log('\n⚠️  Batch completed with some failures');
      process.exit(1);
    } else {
      console.log('\n✅ All templates cloned successfully!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
