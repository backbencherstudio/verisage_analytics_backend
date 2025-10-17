import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Seed admin user from environment variables
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminName = process.env.ADMIN_NAME || 'Admin';
  let adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || '';
  let generatedAdminPassword: string | undefined;

  if (!adminPasswordHash) {
    // If no plaintext is provided, generate a temporary strong password for local/dev
    const plain = adminPasswordPlain || (() => {
      const bytes = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36));
      const chars = bytes.map((n, i) => {
        const c = n.toString(36);
        // Mix in uppercase every few chars for complexity
        return i % 3 === 0 ? c.toUpperCase() : c;
      });
      return chars.join('');
    })();
    if (!adminPasswordPlain) {
      generatedAdminPassword = plain;
      console.warn('ADMIN_PASSWORD not set. Generated a temporary admin password for local/dev seeding.');
    }
    // Hash the plaintext (provided or generated) password
    const bcrypt = require('bcryptjs');
    adminPasswordHash = await bcrypt.hash(plain, 10);
    console.log('Generated hash for admin password:', adminPasswordHash);
  }

  // Upsert admin user
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPasswordHash,
      name: adminName,
      role: 'admin',
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminPasswordHash,
      name: adminName,
      role: 'admin',
      isActive: true,
    },
  });
  console.log('Seeded admin user:', adminUser);
  if (generatedAdminPassword) {
    console.warn('Temporary admin credentials (store securely and rotate soon):');
    console.warn(`  Email:    ${adminEmail}`);
    console.warn(`  Password: ${generatedAdminPassword}`);
  }

  // Idempotent sample data keys
  const sampleStripeCustomerId = 'cus_example_123';
  const sampleStripeSubscriptionId = 'sub_example_123';
  const sampleStripeInvoiceId = 'in_example_123';
  const sampleStripePaymentIntentId = 'pi_example_123';

  // Upsert a sample customer first to satisfy FKs
  const customer = await prisma.customer.upsert({
    where: { stripeCustomerId: sampleStripeCustomerId },
    update: {
      email: 'customer@example.com',
      name: 'Example Customer',
      delinquent: false,
    },
    create: {
      stripeCustomerId: sampleStripeCustomerId,
      email: 'customer@example.com',
      name: 'Example Customer',
      delinquent: false,
    },
  });
  console.log('Upserted customer:', customer.stripeCustomerId);

  // Upsert sample subscription data
  const subscription = await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sampleStripeSubscriptionId },
    update: {
      status: 'active',
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
      metadata: {
        plan: 'Pro',
        features: ['feature1', 'feature2'],
      },
    },
    create: {
      stripeSubscriptionId: sampleStripeSubscriptionId,
      stripeCustomerId: sampleStripeCustomerId,
      status: 'active',
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
      metadata: {
        plan: 'Pro',
        features: ['feature1', 'feature2'],
      },
    },
  });
  console.log('Upserted subscription:', subscription.stripeSubscriptionId);

  // Create an invoice first
  const invoice = await prisma.invoice.upsert({
    where: { stripeInvoiceId: sampleStripeInvoiceId },
    update: {
      number: 'INV-001',
      status: 'paid',
      amountDue: 2999,
      amountPaid: 2999,
      amountRemaining: 0,
      subtotal: 2999,
      total: 2999,
      currency: 'usd',
      paidAt: new Date(),
      metadata: {
        description: 'Monthly subscription',
      },
    },
    create: {
      stripeInvoiceId: sampleStripeInvoiceId,
      stripeCustomerId: sampleStripeCustomerId,
      stripeSubscriptionId: sampleStripeSubscriptionId,
      number: 'INV-001',
      status: 'paid',
      amountDue: 2999,
      amountPaid: 2999,
      amountRemaining: 0,
      subtotal: 2999,
      total: 2999,
      currency: 'usd',
      paidAt: new Date(),
      metadata: {
        description: 'Monthly subscription',
      },
    },
  });
  console.log('Upserted invoice:', invoice.stripeInvoiceId);

  // Example: Create sample payment data
  const payment = await prisma.payment.upsert({
    where: { stripePaymentIntentId: sampleStripePaymentIntentId },
    update: {
      stripeInvoiceId: sampleStripeInvoiceId,
      amount: 2999,
      currency: 'usd',
      status: 'succeeded',
      paidAt: new Date(),
      metadata: {
        description: 'Monthly subscription',
      },
    },
    create: {
      stripePaymentIntentId: sampleStripePaymentIntentId,
      stripeCustomerId: sampleStripeCustomerId,
      stripeInvoiceId: sampleStripeInvoiceId,
      amount: 2999, // $29.99
      currency: 'usd',
      status: 'succeeded',
      paidAt: new Date(),
      metadata: {
        description: 'Monthly subscription',
      },
    },
  });

  console.log('Upserted payment:', payment.stripePaymentIntentId);

  // Example: Create sample GA4 metrics
  const ga4Date = new Date('2025-10-14');
  const existingGa4 = await prisma.gA4Metric.findFirst({
    where: {
      date: ga4Date,
      country: 'United States',
      deviceCategory: 'desktop',
      city: { equals: null },
      browser: { equals: null },
      operatingSystem: { equals: null },
      trafficSource: { equals: null },
    },
  });
  if (existingGa4) {
    await prisma.gA4Metric.update({
      where: { id: existingGa4.id },
      data: {
        activeUsers: 1250,
        sessions: 1800,
        pageViews: 5400,
        avgSessionDuration: 185.5,
        bounceRate: 0.42,
      },
    });
    console.log('Updated existing GA4 metric for 2025-10-14 United States / desktop');
  } else {
    await prisma.gA4Metric.create({
      data: {
        date: ga4Date,
        country: 'United States',
        deviceCategory: 'desktop',
        activeUsers: 1250,
        sessions: 1800,
        pageViews: 5400,
        avgSessionDuration: 185.5,
        bounceRate: 0.42,
      },
    });
    console.log('Created GA4 metric for 2025-10-14 United States / desktop');
  }

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
