#!/bin/sh
echo "Running database setup..."
node /app/node_modules/prisma/build/index.js db push --skip-generate

echo "Running seed..."
node -e "
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const bcrypt = require('/app/node_modules/bcryptjs');
const { z } = require('/app/node_modules/zod');

const prisma = new PrismaClient();

const passwordSchema = z.string().min(8).regex(/[a-zA-Z]/).regex(/[0-9]/);

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('No SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD set, skipping seed.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin ' + email + ' already exists — skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { fullName: 'Admin', email, passwordHash, role: 'admin' }
  });
  console.log('Admin ' + email + ' created successfully.');
}

seed()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.\$disconnect());
"

echo "Starting Next.js..."
exec node server.js
