import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestCompany() {
  try {
    console.log('Creating test company...');

    const testApiKey = 'test_amp_key_teddyfresh_demo_2025';

    // Check if company already exists
    const existing = await prisma.company.findFirst({
      where: { apiKey: testApiKey }
    });

    if (existing) {
      console.log('✅ Test company already exists!');
      console.log(`   Company ID: ${existing.companyId}`);
      console.log(`   API Key: ${existing.apiKey}`);
      return existing;
    }

    // Create new test company
    const company = await prisma.company.create({
      data: {
        companyId: 'test-company-001',
        name: 'Test Company - Teddy Fresh Demo',
        apiKey: testApiKey,
        planType: 'pro',
        creditsRemaining: 10000,
        rateLimitTier: 'pro'
      }
    });

    console.log('✅ Test company created successfully!');
    console.log(`   Company ID: ${company.companyId}`);
    console.log(`   API Key: ${company.apiKey}`);
    console.log(`   Plan: ${company.planType}`);
    console.log(`   Credits: ${company.creditsRemaining}`);

    return company;
  } catch (error) {
    console.error('❌ Error creating test company:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestCompany();
