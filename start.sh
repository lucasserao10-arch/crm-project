#!/bin/sh
echo "Running database setup..."
node /app/node_modules/prisma/build/index.js db push --skip-generate
echo "Running seed..."
node /app/node_modules/prisma/build/index.js db seed
echo "Starting Next.js..."
exec node server.js
