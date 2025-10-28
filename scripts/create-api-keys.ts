import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateApiKey(): string {
  return `amp_${crypto.randomBytes(32).toString('hex')}`;
}

async function createApiKeys() {
  console.log('Creating API keys...');

  try {
    // Create production company
    const productionCompany = await prisma.company.create({
      data: {
        companyId: `company_${crypto.randomBytes(16).toString('hex')}`,
        name: 'Production Account',
        apiKey: generateApiKey(),
        planType: 'professional',
        creditsRemaining: 10000,
        rateLimitTier: 'professional',
      },
    });

    console.log('✅ Production API Key created:');
    console.log(`   Company: ${productionCompany.name}`);
    console.log(`   API Key: ${productionCompany.apiKey}`);
    console.log(`   Plan: ${productionCompany.planType}`);
    console.log(`   Credits: ${productionCompany.creditsRemaining}`);
    console.log(`   Rate Limit: ${productionCompany.rateLimitTier}`);

    // Create test company
    const testCompany = await prisma.company.create({
      data: {
        companyId: `company_${crypto.randomBytes(16).toString('hex')}`,
        name: 'Test Account',
        apiKey: generateApiKey(),
        planType: 'free',
        creditsRemaining: 1000,
        rateLimitTier: 'free',
      },
    });

    console.log('\n✅ Test API Key created:');
    console.log(`   Company: ${testCompany.name}`);
    console.log(`   API Key: ${testCompany.apiKey}`);
    console.log(`   Plan: ${testCompany.planType}`);
    console.log(`   Credits: ${testCompany.creditsRemaining}`);
    console.log(`   Rate Limit: ${testCompany.rateLimitTier}`);

    // Create development company
    const devCompany = await prisma.company.create({
      data: {
        companyId: `company_${crypto.randomBytes(16).toString('hex')}`,
        name: 'Development Account',
        apiKey: generateApiKey(),
        planType: 'free',
        creditsRemaining: 500,
        rateLimitTier: 'free',
      },
    });

    console.log('\n✅ Development API Key created:');
    console.log(`   Company: ${devCompany.name}`);
    console.log(`   API Key: ${devCompany.apiKey}`);
    console.log(`   Plan: ${devCompany.planType}`);
    console.log(`   Credits: ${devCompany.creditsRemaining}`);
    console.log(`   Rate Limit: ${devCompany.rateLimitTier}`);

    console.log('\n📊 Summary:');
    console.log(`   Total API keys created: 3`);
    console.log(`   Production: 1 (professional plan, 10,000 credits)`);
    console.log(`   Test: 1 (free plan, 1,000 credits)`);
    console.log(`   Development: 1 (free plan, 500 credits)`);

  } catch (error) {
    console.error('❌ Error creating API keys:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createApiKeys()
  .then(() => {
    console.log('\n✅ API keys created successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to create API keys:', error);
    process.exit(1);
  });
