import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Apply Prisma schema to Supabase
 * This uses Supabase SQL Editor to bypass direct database connection issues
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applySchema() {
  console.log('🚀 Applying Prisma schema to Supabase...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    console.log('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n');
    process.exit(1);
  }

  try {
    // Read the generated schema SQL
    const schemaPath = path.join(__dirname, 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
      console.error('❌ schema.sql not found!');
      console.log('   Run: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > schema.sql\n');
      process.exit(1);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📄 Schema SQL loaded from schema.sql');
    console.log(`📊 SQL length: ${schemaSql.length} characters`);
    console.log(`📊 Tables to create: 6 (companies, campaigns, templates, generation_logs, analytics, personalization_history)\n`);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log('🔗 Supabase client initialized');
    console.log(`📍 Project: ${SUPABASE_URL}\n`);

    // Split SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;

      try {
        const { data, error } = await supabase.rpc('exec_sql', { query: stmt + ';' });

        if (error) {
          // Try direct query approach
          const result = await fetch(`${SUPABASE_URL}/rest/v1/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify({ query: stmt + ';' })
          });

          if (!result.ok) {
            throw new Error(`HTTP ${result.status}: ${await result.text()}`);
          }
        }

        successCount++;
        process.stdout.write(`✅ Statement ${i + 1}/${statements.length}\r`);
      } catch (error: any) {
        errorCount++;
        console.error(`\n❌ Error in statement ${i + 1}: ${error.message}`);
      }
    }

    console.log(`\n\n📊 Results: ${successCount} succeeded, ${errorCount} failed\n`);

    if (errorCount > 0) {
      throw new Error('Some SQL statements failed. See errors above.');
    }

    console.log('✅ Schema applied successfully!\n');
    console.log('📋 Created tables:');
    console.log('   ✓ companies');
    console.log('   ✓ campaigns');
    console.log('   ✓ templates');
    console.log('   ✓ generation_logs');
    console.log('   ✓ analytics');
    console.log('   ✓ personalization_history\n');

    console.log('🎉 Database is ready! Test your connection:');
    console.log('   npx ts-node test-prisma.ts\n');

  } catch (error: any) {
    console.error('\n❌ Automated schema application failed:', error.message);
    console.log('\n💡 Manual solution (recommended):');
    console.log('   1. Go to: https://app.supabase.com/project/oeztikupnlchucnhhhnf/sql');
    console.log('   2. Click "New Query"');
    console.log('   3. Copy the contents of schema.sql');
    console.log('   4. Paste into the SQL editor');
    console.log('   5. Click "Run" or press Ctrl+Enter\n');
    console.log('📄 Schema file location: ' + path.join(__dirname, 'schema.sql'));
    process.exit(1);
  }
}

// Run the function
applySchema();
