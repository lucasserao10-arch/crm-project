#!/bin/sh
echo "Running database setup..."
node /app/node_modules/prisma/build/index.js db push --skip-generate
echo "Running seed..."
node /app/node_modules/ts-node/dist/bin.js --compiler-options '{"module":"CommonJS"}' /app/prisma/seed.ts
echo "Starting Next.js..."
exec node server.js
