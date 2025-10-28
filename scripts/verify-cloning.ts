/**
 * Verification Script for Template Cloning
 * Verifies all templates were successfully cloned and validates quality
 */

import fs from 'fs';
import path from 'path';
import templateCloningService from '../src/services/templateCloning';

interface VerificationReport {
  htmlFilesCount: number;
  metadataFilesCount: number;
  expectedCount: number;
  missingHTML: string[];
  missingMetadata: string[];
  ampValidationResults: Array<{
    template: string;
    valid: boolean;
    errors: string[];
  }>;
  batchSummary: any;
}

async function main() {
  console.log('🔍 TEMPLATE CLONING VERIFICATION');
  console.log('='.repeat(60));

  const outputDir = path.join(process.cwd(), 'cloned_templates');
  const metadataDir = path.join(outputDir, 'metadata');
  const templatesDir = path.join(process.cwd(), 'flodesk_templates');

  const report: VerificationReport = {
    htmlFilesCount: 0,
    metadataFilesCount: 0,
    expectedCount: 0,
    missingHTML: [],
    missingMetadata: [],
    ampValidationResults: [],
    batchSummary: null,
  };

  // Step 1: Count expected templates
  console.log('\n📊 Step 1: Counting Templates');
  console.log('-'.repeat(60));
  
  const sourceTemplates = fs
    .readdirSync(templatesDir)
    .filter((f) => f.toLowerCase().endsWith('.png'));
  
  report.expectedCount = sourceTemplates.length;
  console.log(`Expected templates: ${report.expectedCount}`);

  // Step 2: Count HTML files
  console.log('\n📄 Step 2: Verifying HTML Files');
  console.log('-'.repeat(60));
  
  if (fs.existsSync(outputDir)) {
    const htmlFiles = fs
      .readdirSync(outputDir)
      .filter((f) => f.toLowerCase().endsWith('.html'));
    
    report.htmlFilesCount = htmlFiles.length;
    console.log(`HTML files found: ${report.htmlFilesCount}/${report.expectedCount}`);

    // Check for missing HTML files
    sourceTemplates.forEach((template) => {
      const baseName = template.replace('.png', '');
      const htmlPath = path.join(outputDir, `${baseName}.html`);
      if (!fs.existsSync(htmlPath)) {
        report.missingHTML.push(template);
      }
    });

    if (report.missingHTML.length > 0) {
      console.log(`❌ Missing HTML files: ${report.missingHTML.length}`);
      report.missingHTML.forEach((t) => console.log(`   - ${t}`));
    } else {
      console.log('✅ All HTML files present');
    }
  } else {
    console.log('❌ Output directory not found');
  }

  // Step 3: Count metadata files
  console.log('\n📋 Step 3: Verifying Metadata Files');
  console.log('-'.repeat(60));
  
  if (fs.existsSync(metadataDir)) {
    const metadataFiles = fs
      .readdirSync(metadataDir)
      .filter((f) => f.toLowerCase().endsWith('.json') && !f.includes('summary'));
    
    report.metadataFilesCount = metadataFiles.length;
    console.log(`Metadata files found: ${report.metadataFilesCount}/${report.expectedCount}`);

    // Check for missing metadata files
    sourceTemplates.forEach((template) => {
      const baseName = template.replace('.png', '');
      const metadataPath = path.join(metadataDir, `${baseName}.json`);
      if (!fs.existsSync(metadataPath)) {
        report.missingMetadata.push(template);
      }
    });

    if (report.missingMetadata.length > 0) {
      console.log(`❌ Missing metadata files: ${report.missingMetadata.length}`);
      report.missingMetadata.forEach((t) => console.log(`   - ${t}`));
    } else {
      console.log('✅ All metadata files present');
    }
  } else {
    console.log('❌ Metadata directory not found');
  }

  // Step 4: Load batch summary
  console.log('\n📊 Step 4: Reading Batch Summary');
  console.log('-'.repeat(60));
  
  const summaryPath = path.join(metadataDir, 'batch_summary.json');
  if (fs.existsSync(summaryPath)) {
    report.batchSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    console.log('✅ Batch summary found');
    console.log(`   Total Templates: ${report.batchSummary.total_templates}`);
    console.log(`   Successful: ${report.batchSummary.successful_clones}`);
    console.log(`   Failed: ${report.batchSummary.failed_clones}`);
    console.log(`   Processing Time: ${(report.batchSummary.total_processing_time / 1000 / 60).toFixed(2)} min`);
    console.log(`   Estimated Cost: $${report.batchSummary.total_cost_estimate.toFixed(4)}`);

    if (report.batchSummary.failed_clones > 0) {
      console.log(`\n⚠️  Failed Templates:`);
      report.batchSummary.failed_template_list.forEach((t: string) => console.log(`   - ${t}`));
    }
  } else {
    console.log('❌ Batch summary not found');
  }

  // Step 5: Validate random sample of AMP compliance
  console.log('\n✔️  Step 5: AMP Validation (10 Random Samples)');
  console.log('-'.repeat(60));
  
  if (report.htmlFilesCount > 0) {
    const htmlFiles = fs
      .readdirSync(outputDir)
      .filter((f) => f.toLowerCase().endsWith('.html'));

    // Select 10 random templates
    const sampleSize = Math.min(10, htmlFiles.length);
    const shuffled = [...htmlFiles].sort(() => 0.5 - Math.random());
    const samples = shuffled.slice(0, sampleSize);

    console.log(`Validating ${samples.length} templates...`);

    samples.forEach((htmlFile) => {
      const htmlPath = path.join(outputDir, htmlFile);
      const html = fs.readFileSync(htmlPath, 'utf-8');
      const validation = templateCloningService.validateAMP(html);

      report.ampValidationResults.push({
        template: htmlFile,
        valid: validation.valid,
        errors: validation.errors,
      });

      if (validation.valid) {
        console.log(`   ✅ ${htmlFile}: PASSED`);
      } else {
        console.log(`   ❌ ${htmlFile}: FAILED`);
        validation.errors.forEach((err) => console.log(`      - ${err}`));
      }
    });

    const passedCount = report.ampValidationResults.filter((r) => r.valid).length;
    console.log(`\nValidation Results: ${passedCount}/${samples.length} passed`);
  }

  // Step 6: Final Report
  console.log('\n' + '='.repeat(60));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  const allFilesPresent = 
    report.htmlFilesCount === report.expectedCount &&
    report.metadataFilesCount === report.expectedCount;

  const allValidationsPassed = 
    report.ampValidationResults.length > 0 &&
    report.ampValidationResults.every((r) => r.valid);

  if (allFilesPresent && allValidationsPassed) {
    console.log('✅ ALL CHECKS PASSED');
    console.log(`   - ${report.htmlFilesCount} HTML templates`);
    console.log(`   - ${report.metadataFilesCount} metadata files`);
    console.log(`   - ${report.ampValidationResults.filter(r => r.valid).length} AMP validations passed`);
    
    if (report.batchSummary) {
      console.log(`   - ${report.batchSummary.successful_clones} successful clones`);
      console.log(`   - $${report.batchSummary.total_cost_estimate.toFixed(4)} estimated cost`);
    }
  } else {
    console.log('❌ VERIFICATION ISSUES FOUND');
    
    if (report.missingHTML.length > 0) {
      console.log(`   - ${report.missingHTML.length} missing HTML files`);
    }
    
    if (report.missingMetadata.length > 0) {
      console.log(`   - ${report.missingMetadata.length} missing metadata files`);
    }
    
    const failedValidations = report.ampValidationResults.filter((r) => !r.valid);
    if (failedValidations.length > 0) {
      console.log(`   - ${failedValidations.length} failed AMP validations`);
    }
  }

  console.log('='.repeat(60));

  // Save verification report
  const reportPath = path.join(outputDir, 'metadata', 'verification_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n📄 Verification report saved: ${reportPath}`);

  // Exit with appropriate code
  if (allFilesPresent && allValidationsPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Verification error:', error);
  process.exit(1);
});
