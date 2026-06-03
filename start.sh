#!/bin/sh
echo "Running database setup..."
npx prisma db push --skip-generate
echo "Running seed..."
npx prisma db seed
echo "Starting Next.js..."
exec node server.js
