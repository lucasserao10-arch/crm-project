# CRM Login & Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack CRM with email/password auth, contacts/interactions/deals management, and a kanban pipeline, deployed on EasyPanel via Docker Compose.

**Architecture:** Next.js 14 App Router with Server Actions for all mutations, NextAuth.js v5 Credentials for JWT-based auth (httpOnly+Secure cookie, 8h expiry, updateAge=3600s), Prisma ORM against PostgreSQL, all running in Docker Compose on EasyPanel.

**Tech Stack:** Next.js 14, NextAuth.js v5, Prisma 5, PostgreSQL 16, Tailwind CSS, shadcn/ui, react-hook-form, zod, lru-cache, bcryptjs, nodemailer, @dnd-kit/core

---

## File Map

```
crm-project/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── next.config.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── src/
    ├── auth.ts                          # NextAuth config
    ├── middleware.ts                    # Route protection + rate limiting
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── reset-password/page.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx               # Sidebar + header shell
    │   │   ├── dashboard/page.tsx
    │   │   ├── contacts/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── deals/page.tsx
    │   │   └── profile/page.tsx
    │   ├── admin/
    │   │   └── users/page.tsx
    │   └── api/
    │       └── health/route.ts
    ├── actions/
    │   ├── auth.ts                      # login, logout, password reset
    │   ├── contacts.ts
    │   ├── interactions.ts
    │   ├── deals.ts
    │   ├── users.ts                     # admin user management + invites
    │   └── profile.ts
    ├── components/
    │   ├── layout/
    │   │   ├── sidebar.tsx
    │   │   └── header.tsx
    │   ├── auth/
    │   │   ├── login-form.tsx
    │   │   └── reset-password-form.tsx
    │   ├── contacts/
    │   │   ├── contact-list.tsx
    │   │   ├── contact-form.tsx
    │   │   └── contact-detail.tsx
    │   ├── interactions/
    │   │   └── interaction-form.tsx
    │   ├── deals/
    │   │   ├── kanban-board.tsx
    │   │   └── deal-card.tsx
    │   ├── dashboard/
    │   │   └── stats-cards.tsx
    │   └── admin/
    │       └── user-list.tsx
    └── lib/
        ├── prisma.ts                    # Prisma client singleton
        ├── rate-limit.ts               # lru-cache rate limiter
        ├── email.ts                    # nodemailer wrapper
        ├── tokens.ts                   # token generation/validation
        └── validations.ts             # shared zod schemas
```

---

## Phase 1 — Foundation

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`

- [ ] **Step 1: Create the project**

```bash
cd C:\Users\Lenovo
npx create-next-app@14 crm-project --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
cd crm-project
```

- [ ] **Step 2: Install dependencies**

```bash
npm install next-auth@beta @auth/prisma-adapter prisma @prisma/client bcryptjs nodemailer react-hook-form @hookform/resolvers zod lru-cache @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D @types/bcryptjs @types/nodemailer
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted: TypeScript=yes, style=default, base color=slate, CSS variables=yes.

- [ ] **Step 4: Add shadcn components**

```bash
npx shadcn@latest add button input label card table badge toast dropdown-menu dialog form select separator avatar
```

- [ ] **Step 5: Initialize git and first commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js 14 project with shadcn/ui"
```

---

### Task 2: Docker + environment setup

**Files:**
- Create: `docker-compose.yml`, `Dockerfile`, `.env.example`, `.env.local`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: crm
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://crm:${POSTGRES_PASSWORD}@db:5432/crm
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM: ${SMTP_FROM}
      SEED_ADMIN_EMAIL: ${SEED_ADMIN_EMAIL}
      SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
```

- [ ] **Step 3: Create .env.example**

```bash
# .env.example
DATABASE_URL=postgresql://crm:password@localhost:5432/crm
NEXTAUTH_SECRET=your-32-char-secret-here
NEXTAUTH_URL=https://crm.empresa.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=smtp-password
SMTP_FROM=no-reply@empresa.com
SEED_ADMIN_EMAIL=admin@empresa.com
SEED_ADMIN_PASSWORD=Admin1234
POSTGRES_PASSWORD=strong-db-password
```

- [ ] **Step 4: Create .env.local for development**

Copy `.env.example` to `.env.local` and fill in values. For local dev use `DATABASE_URL=postgresql://crm:password@localhost:5432/crm`.

- [ ] **Step 5: Update next.config.ts for standalone output**

```typescript
// next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
}

export default nextConfig
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml Dockerfile .env.example next.config.ts
git commit -m "feat: add Docker Compose setup with healthchecks"
```

---

### Task 3: Prisma schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write the full schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  admin
  user
}

enum TokenType {
  reset
  invite
}

enum InteractionType {
  call
  email
  meeting
  note
}

enum DealStage {
  lead
  qualified
  proposal
  negotiation
  closed_won
  closed_lost
}

model User {
  id           String   @id @default(uuid())
  fullName     String   @map("full_name")
  email        String   @unique
  passwordHash String?  @map("password_hash")
  role         Role     @default(user)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  contacts          Contact[]
  interactions      Interaction[]
  deals             Deal[]
  passwordResetTokens PasswordResetToken[]

  @@map("users")
}

model Contact {
  id        String   @id @default(uuid())
  name      String
  email     String?
  phone     String?
  company   String?
  ownerId   String   @map("owner_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  owner        User          @relation(fields: [ownerId], references: [id])
  interactions Interaction[]
  deals        Deal[]

  @@index([ownerId])
  @@map("contacts")
}

model Interaction {
  id        String          @id @default(uuid())
  contactId String          @map("contact_id")
  ownerId   String          @map("owner_id")
  type      InteractionType
  notes     String?
  date      DateTime
  createdAt DateTime        @default(now()) @map("created_at")
  updatedAt DateTime        @updatedAt @map("updated_at")

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  owner   User    @relation(fields: [ownerId], references: [id])

  @@index([contactId])
  @@index([ownerId])
  @@map("interactions")
}

model Deal {
  id        String    @id @default(uuid())
  contactId String    @map("contact_id")
  ownerId   String    @map("owner_id")
  title     String
  value     Decimal?  @db.Decimal(12, 2)
  stage     DealStage @default(lead)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  owner   User    @relation(fields: [ownerId], references: [id])

  @@index([contactId])
  @@index([ownerId])
  @@index([stage])
  @@map("deals")
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash")
  type      TokenType
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created and applied. Prisma Client generated.

- [ ] **Step 4: Verify schema**

```bash
npx prisma studio
```

Open browser at http://localhost:5555 and confirm all 5 tables exist.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema with all CRM models and indexes"
```

---

### Task 4: Shared lib files

**Files:**
- Create: `src/lib/prisma.ts`, `src/lib/validations.ts`, `src/lib/rate-limit.ts`, `src/lib/email.ts`, `src/lib/tokens.ts`

- [ ] **Step 1: Create Prisma singleton**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query"] : [] })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 2: Create shared zod schemas**

```typescript
// src/lib/validations.ts
import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[a-zA-Z]/, "Deve conter pelo menos 1 letra")
  .regex(/[0-9]/, "Deve conter pelo menos 1 número")

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
})

export const contactSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(150, "Máximo 150 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  company: z.string().max(150).optional().or(z.literal("")),
  ownerId: z.string().uuid("Owner inválido"),
})

export const interactionSchema = z.object({
  contactId: z.string().uuid(),
  type: z.enum(["call", "email", "meeting", "note"]),
  notes: z.string().max(2000).optional().or(z.literal("")),
  date: z.string().min(1, "Data obrigatória"), // accepts datetime-local format (no TZ)
})

export const dealSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().min(1, "Título obrigatório").max(200, "Máximo 200 caracteres"),
  value: z.number().nonnegative("Valor não pode ser negativo").optional(),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]),
})

export const updateDealStageSchema = z.object({
  dealId: z.string().uuid(),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]),
  updatedAt: z.string().datetime(),
})

export const profileSchema = z.object({
  fullName: z.string().min(1, "Nome obrigatório").max(100, "Máximo 100 caracteres"),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatória"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Senhas não coincidem",
    path: ["confirmPassword"],
  })

export const createUserSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
})

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
})

export const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não coincidem",
    path: ["confirmPassword"],
  })
```

- [ ] **Step 3: Create rate limiter**

```typescript
// src/lib/rate-limit.ts
import { LRUCache } from "lru-cache"

type Options = { uniqueTokenPerInterval?: number; interval?: number }

export function rateLimit(options?: Options) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60_000,
  })

  return {
    check: (limit: number, token: string) => {
      const tokenCount = tokenCache.get(token) ?? []
      const now = Date.now()
      const windowStart = now - (options?.interval ?? 60_000)
      const requestsInWindow = tokenCount.filter((ts) => ts > windowStart)

      if (requestsInWindow.length >= limit) {
        return { success: false, remaining: 0 }
      }

      tokenCache.set(token, [...requestsInWindow, now])
      return { success: true, remaining: limit - requestsInWindow.length - 1 }
    },
  }
}

export const loginLimiter = rateLimit({ interval: 15 * 60 * 1000, uniqueTokenPerInterval: 500 })
export const resetLimiter = rateLimit({ interval: 60 * 60 * 1000, uniqueTokenPerInterval: 500 })
```

- [ ] **Step 4: Create email helper**

```typescript
// src/lib/email.ts
import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  })
}

export function resetPasswordEmailHtml(link: string) {
  return `
    <p>Você solicitou a redefinição de senha.</p>
    <p><a href="${link}">Clique aqui para redefinir sua senha</a></p>
    <p>Este link expira em 1 hora.</p>
  `
}

export function inviteEmailHtml(link: string, fullName: string) {
  return `
    <p>Olá ${fullName},</p>
    <p>Você foi convidado para acessar o CRM.</p>
    <p><a href="${link}">Clique aqui para criar sua senha e acessar</a></p>
    <p>Este link expira em 24 horas.</p>
  `
}
```

- [ ] **Step 5: Create token helper**

```typescript
// src/lib/tokens.ts
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { TokenType } from "@prisma/client"

export function generateToken(): { plaintext: string; hash: string } {
  const plaintext = crypto.randomBytes(32).toString("hex")
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex")
  return { plaintext, hash }
}

export async function createToken(
  userId: string,
  type: TokenType,
  expiresInMs: number
): Promise<string> {
  const { plaintext, hash } = generateToken()

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    })
    await tx.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hash,
        type,
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    })
  })

  return plaintext
}

export async function validateToken(plaintext: string, expectedType: TokenType) {
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex")

  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  })

  if (!token) return { valid: false as const, reason: "not_found" }
  if (token.type !== expectedType) return { valid: false as const, reason: "wrong_type" }
  if (token.expiresAt < new Date()) return { valid: false as const, reason: "expired" }
  if (token.usedAt) return { valid: false as const, reason: "used" }

  return { valid: true as const, token }
}

export async function consumeToken(tokenId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    })
    await tx.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    })
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/
git commit -m "feat: add prisma singleton, zod schemas, rate limiter, email and token helpers"
```

---

### Task 5: Prisma seed

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write seed script**

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { passwordSchema } from "../src/lib/validations"

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set")
  }

  const validation = z.string().email().safeParse(email)
  if (!validation.success) throw new Error("SEED_ADMIN_EMAIL is not a valid email")

  const passwordValidation = passwordSchema.safeParse(password)
  if (!passwordValidation.success) {
    throw new Error(`SEED_ADMIN_PASSWORD is too weak: ${passwordValidation.error.issues[0].message}`)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin ${email} already exists — skipping seed.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { fullName: "Admin", email, passwordHash, role: "admin" },
  })

  console.log(`Admin ${email} created successfully.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Add seed config to package.json**

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Also install: `npm install -D ts-node`

- [ ] **Step 3: Test seed**

```bash
SEED_ADMIN_EMAIL=admin@test.com SEED_ADMIN_PASSWORD=Admin1234 npx prisma db seed
```

Expected output: `Admin admin@test.com created successfully.`

Run again — expected: `Admin admin@test.com already exists — skipping seed.`

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add idempotent admin seed script with password policy validation"
```

---

## Phase 2 — Authentication

### Task 6: NextAuth configuration

**Files:**
- Create: `src/auth.ts`

- [ ] **Step 1: Create NextAuth config**

```typescript
// src/auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { loginSchema } from "@/lib/validations"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })

        if (!user || !user.passwordHash || !user.active) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }

      const shouldRefresh =
        trigger === "update" ||
        (token.refreshedAt
          ? Date.now() - (token.refreshedAt as number) > 3600 * 1000
          : true)

      if (shouldRefresh && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, active: true },
        })
        if (!dbUser || !dbUser.active) return null as unknown as typeof token
        token.role = dbUser.role
        token.refreshedAt = Date.now()
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: { signIn: "/login" },
  trustHost: true,
})

declare module "next-auth" {
  interface Session {
    user: { id: string; role: string; email: string; name: string }
  }
}
```

- [ ] **Step 2: Add NextAuth route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts src/app/api/auth/
git commit -m "feat: configure NextAuth v5 with Credentials provider, JWT, role re-validation"
```

---

### Task 7: Middleware + /api/health

**Files:**
- Create: `src/middleware.ts`, `src/app/api/health/route.ts`

- [ ] **Step 1: Write middleware**

```typescript
// src/middleware.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { loginLimiter, resetLimiter } from "@/lib/rate-limit"

const PUBLIC_PATHS = ["/login", "/reset-password", "/api/auth", "/api/health"]
const PROTECTED_PATHS = ["/dashboard", "/contacts", "/deals", "/profile"]
const ADMIN_PATHS = ["/admin"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"

  // Public paths — always allow
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // Redirect authenticated users away from login/reset-password
    if (session && (pathname.startsWith("/login") || pathname.startsWith("/reset-password"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // Rate limiting for login and reset
  if (pathname === "/api/login-rate-check") {
    const result = loginLimiter.check(5, ip)
    if (!result.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    return NextResponse.next()
  }

  // Admin paths
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url))
    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // Protected paths
  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url))
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

- [ ] **Step 2: Write /api/health route**

```typescript
// src/app/api/health/route.ts
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json({ status: "error", message: "Database unavailable" }, { status: 503 })
  }
}
```

- [ ] **Step 3: Test health endpoint**

Start dev server: `npm run dev`

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts src/app/api/health/
git commit -m "feat: add middleware with route protection, rate limiting, and /api/health endpoint"
```

---

### Task 8: Login page + auth actions

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx`, `src/actions/auth.ts`

- [ ] **Step 1: Create auth Server Actions**

```typescript
// src/actions/auth.ts
"use server"

import { signIn, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { loginLimiter, resetLimiter } from "@/lib/rate-limit"
import { sendEmail, resetPasswordEmailHtml } from "@/lib/email"
import { createToken, validateToken, consumeToken } from "@/lib/tokens"
import { resetPasswordRequestSchema, setPasswordSchema } from "@/lib/validations"
import { passwordSchema } from "@/lib/validations"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export async function loginAction(formData: FormData) {
  const ip = (await headers()).get("x-forwarded-for") ?? "anonymous"
  const result = loginLimiter.check(5, ip)
  if (!result.success) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." }
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    })
  } catch (e: unknown) {
    const msg = (e as Error).message ?? ""
    if (msg.includes("CredentialsSignin") || msg.includes("CallbackRouteError")) {
      return { error: "Email ou senha incorretos." }
    }
    throw e
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" })
}

export async function requestPasswordResetAction(formData: FormData) {
  const ip = (await headers()).get("x-forwarded-for") ?? "anonymous"
  const result = resetLimiter.check(3, ip)
  if (!result.success) {
    return { error: "Muitas tentativas. Tente novamente mais tarde." }
  }

  const parsed = resetPasswordRequestSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { error: "Email inválido." }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

  // Always return generic response (prevent enumeration)
  if (!user || !user.active) {
    return { success: true }
  }

  try {
    const token = await createToken(user.id, "reset", 60 * 60 * 1000)
    const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
    await sendEmail({
      to: user.email,
      subject: "Redefinição de senha",
      html: resetPasswordEmailHtml(link),
    })
  } catch (e) {
    console.error("SMTP error on password reset:", e)
  }

  return { success: true }
}

export async function setPasswordAction(data: { token: string; password: string; type: "reset" | "invite" }) {
  const passwordValidation = passwordSchema.safeParse(data.password)
  if (!passwordValidation.success) {
    return { error: passwordValidation.error.issues[0].message }
  }

  const result = await validateToken(data.token, data.type)
  if (!result.valid) {
    return { error: "Link inválido ou já utilizado." }
  }

  const { token } = result

  if (!token.user.active) {
    return { error: "Esta conta está desativada." }
  }

  const passwordHash = await bcrypt.hash(data.password, 12)

  await prisma.user.update({
    where: { id: token.userId },
    data: { passwordHash },
  })

  await consumeToken(token.id, token.userId)

  if (data.type === "reset") {
    await signOut({ redirect: false })
    redirect("/login")
  }

  // For invite: auto-login
  await signIn("credentials", {
    email: token.user.email,
    password: data.password,
    redirectTo: "/dashboard",
  })
}
```

- [ ] **Step 2: Create login form component**

```tsx
// src/components/auth/login-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { loginSchema } from "@/lib/validations"
import { loginAction, requestPasswordResetAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type LoginForm = z.infer<typeof loginSchema>

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    setError(null)
    const fd = new FormData()
    fd.append("email", data.email)
    fd.append("password", data.password)
    const result = await loginAction(fd)
    if (result?.error) setError(result.error)
    setLoading(false)
  }

  async function onResetRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await requestPasswordResetAction(fd)
    setResetSent(true)
    setLoading(false)
  }

  if (showReset) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Redefinir senha</CardTitle></CardHeader>
        <CardContent>
          {resetSent ? (
            <p className="text-sm text-muted-foreground">
              Se este email estiver cadastrado, você receberá as instruções em breve.
            </p>
          ) : (
            <form onSubmit={onResetRequest} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
            </form>
          )}
          <button onClick={() => setShowReset(false)} className="mt-4 text-sm text-primary underline">
            Voltar ao login
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle>Entrar</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...register("email")} type="email" autoComplete="email" />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" {...register("password")} type="password" autoComplete="current-password" />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-sm text-primary underline w-full text-center"
          >
            Esqueci minha senha
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create login page**

```tsx
// src/app/(auth)/login/page.tsx
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <LoginForm />
    </main>
  )
}
```

- [ ] **Step 4: Manual test — login flow**

```
1. Open http://localhost:3000/login
2. Submit with wrong credentials → should show "Email ou senha incorretos."
3. Submit 6 times with wrong credentials → should show rate limit message on 6th
4. Submit with correct seed credentials → should redirect to /dashboard
```

- [ ] **Step 5: Commit**

```bash
git add src/actions/auth.ts src/components/auth/login-form.tsx src/app/\(auth\)/
git commit -m "feat: add login page, auth actions, password reset request flow"
```

---

### Task 9: Reset password page

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`, `src/components/auth/reset-password-form.tsx`

- [ ] **Step 1: Create reset password form**

```tsx
// src/components/auth/reset-password-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { setPasswordSchema } from "@/lib/validations"
import { setPasswordAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

type Form = z.infer<typeof setPasswordSchema>

export function ResetPasswordForm({ token, type }: { token: string; type: "reset" | "invite" }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { token },
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    const result = await setPasswordAction({ token: data.token, password: data.password, type })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{type === "invite" ? "Criar sua senha" : "Nova senha"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("token")} />
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" {...register("password")} type="password" />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input id="confirmPassword" {...register("confirmPassword")} type="password" />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          {error && (
            <div className="text-sm text-destructive space-y-1">
              <p>{error}</p>
              <Link href="/login" className="underline text-primary">Voltar ao login</Link>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create reset password page**

```tsx
// src/app/(auth)/reset-password/page.tsx
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { validateToken } from "@/lib/tokens"
import Link from "next/link"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; type?: string }>
}) {
  const { token, type } = await searchParams

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p>Este link é inválido ou já foi utilizado.</p>
          <Link href="/login" className="text-primary underline">Voltar ao login</Link>
        </div>
      </main>
    )
  }

  const tokenType = type === "invite" ? "invite" : "reset"
  const result = await validateToken(token, tokenType)

  if (!result.valid) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p>Este link é inválido ou já foi utilizado.</p>
          <Link href="/login" className="text-primary underline">Voltar ao login</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <ResetPasswordForm token={token} type={tokenType} />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/reset-password/ src/components/auth/reset-password-form.tsx
git commit -m "feat: add reset-password page with token type validation"
```

---

## Phase 3 — Dashboard Shell

### Task 10: Dashboard layout (sidebar + header)

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`

- [ ] **Step 1: Create sidebar**

```tsx
// src/components/layout/sidebar.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, FolderKanban, User, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/deals", label: "Funil", icon: FolderKanban },
  { href: "/profile", label: "Perfil", icon: User },
]

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen border-r bg-card flex flex-col">
      <div className="p-4 font-bold text-lg border-b">CRM</div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith(href) && href !== "/dashboard"
                ? "bg-primary text-primary-foreground"
                : pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
        {role === "admin" && (
          <Link
            href="/admin/users"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/admin") ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            Usuários
          </Link>
        )}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create header**

```tsx
// src/components/layout/header.tsx
import { auth } from "@/auth"
import { logoutAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export async function Header() {
  const session = await auth()
  const initials = session?.user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "U"

  return (
    <header className="h-14 border-b flex items-center justify-between px-6 bg-card">
      <div />
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{session?.user.name}</span>
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" type="submit">Sair</Button>
        </form>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create dashboard layout**

```tsx
// src/app/(dashboard)/layout.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex min-h-screen">
      <Sidebar role={session.user.role} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create placeholder dashboard page**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
export default function DashboardPage() {
  return <div><h1 className="text-2xl font-bold">Dashboard</h1></div>
}
```

- [ ] **Step 5: Manual test**

```
1. Login with admin credentials
2. Should see sidebar with Dashboard, Contatos, Funil, Perfil, Usuários
3. Login with user credentials
4. Sidebar should NOT have Usuários link
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/ src/components/layout/
git commit -m "feat: add dashboard layout with sidebar and header"
```

---

## Phase 4 — CRM Core

### Task 11: Contacts Server Actions

**Files:**
- Create: `src/actions/contacts.ts`

- [ ] **Step 1: Write contacts actions**

```typescript
// src/actions/contacts.ts
"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { contactSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

async function getSession() {
  const session = await auth()
  if (!session) throw new Error("Unauthorized")
  return session
}

function buildContactWhere(session: Awaited<ReturnType<typeof getSession>>, extra = {}) {
  const where: Record<string, unknown> = { ...extra }
  if (session.user.role !== "admin") {
    where.ownerId = session.user.id
  }
  return where
}

export async function getContacts({
  page = 1,
  search = "",
  ownerId,
}: {
  page?: number
  search?: string
  ownerId?: string
}) {
  const session = await getSession()
  const pageSize = 25
  const skip = (page - 1) * pageSize

  const where = buildContactWhere(session)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ]
  }
  if (ownerId && session.user.role === "admin") {
    where.ownerId = ownerId
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({ where, skip, take: pageSize, orderBy: { name: "asc" }, include: { owner: { select: { id: true, fullName: true } } } }),
    prisma.contact.count({ where }),
  ])

  return { contacts, total, pages: Math.ceil(total / pageSize) }
}

export async function getContact(id: string) {
  const session = await getSession()
  const where = buildContactWhere(session, { id })
  const contact = await prisma.contact.findFirst({
    where,
    include: {
      owner: { select: { id: true, fullName: true } },
      interactions: { orderBy: { date: "desc" } },
      deals: { orderBy: { createdAt: "desc" } },
    },
  })
  return contact
}

export async function createContact(formData: FormData) {
  const session = await getSession()
  const raw = Object.fromEntries(formData)

  // User always gets their own id as owner
  if (session.user.role !== "admin") {
    raw.ownerId = session.user.id
  }

  const parsed = contactSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Admin must not set a different owner_id than what will be used for child records
  await prisma.contact.create({ data: parsed.data })
  revalidatePath("/contacts")
  return { success: true }
}

export async function updateContact(id: string, formData: FormData) {
  const session = await getSession()
  const where = buildContactWhere(session, { id })
  const contact = await prisma.contact.findFirst({ where })
  if (!contact) return { error: "Contato não encontrado." }

  const raw = Object.fromEntries(formData)
  // owner_id is immutable — always use existing value
  raw.ownerId = contact.ownerId

  const parsed = contactSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await prisma.contact.update({ where: { id }, data: parsed.data })
  revalidatePath("/contacts")
  revalidatePath(`/contacts/${id}`)
  return { success: true }
}

export async function deleteContact(id: string) {
  const session = await getSession()
  const where = buildContactWhere(session, { id })
  const contact = await prisma.contact.findFirst({ where })
  if (!contact) return { error: "Contato não encontrado." }

  await prisma.contact.delete({ where: { id } })
  revalidatePath("/contacts")
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/contacts.ts
git commit -m "feat: add contacts Server Actions with owner scoping and immutable owner_id"
```

---

### Task 12: Contacts pages + components

**Files:**
- Create: `src/app/(dashboard)/contacts/page.tsx`, `src/app/(dashboard)/contacts/[id]/page.tsx`, `src/components/contacts/contact-list.tsx`, `src/components/contacts/contact-form.tsx`, `src/components/contacts/contact-detail.tsx`

- [ ] **Step 1: Create contacts list page**

```tsx
// src/app/(dashboard)/contacts/page.tsx
import { auth } from "@/auth"
import { getContacts } from "@/actions/contacts"
import { ContactList } from "@/components/contacts/contact-list"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; ownerId?: string }>
}) {
  const session = await auth()
  const { page, search, ownerId } = await searchParams
  const data = await getContacts({ page: Number(page ?? 1), search, ownerId })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contatos</h1>
      <ContactList data={data} isAdmin={session?.user.role === "admin"} userId={session!.user.id} />
    </div>
  )
}
```

- [ ] **Step 2: Create contact list component**

```tsx
// src/components/contacts/contact-list.tsx
"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { deleteContact } from "@/actions/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ContactForm } from "./contact-form"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

type Contact = { id: string; name: string; email: string | null; company: string | null; owner: { fullName: string } }
type Props = { data: { contacts: Contact[]; total: number; pages: number }; isAdmin: boolean; userId: string }

export function ContactList({ data, isAdmin, userId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [open, setOpen] = useState(false)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    params.set("search", search)
    params.set("page", "1")
    router.push(`/contacts?${params}`)
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este contato e todos os seus dados?")) return
    await deleteContact(id)
  }

  const page = Number(searchParams.get("page") ?? 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            placeholder="Buscar por nome, email, telefone ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary" size="sm">Buscar</Button>
        </form>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Novo contato</Button>
          </DialogTrigger>
          <DialogContent>
            <ContactForm isAdmin={isAdmin} onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Empresa</th>
              {isAdmin && <th className="text-left p-3">Responsável</th>}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data.contacts.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/50">
                <td className="p-3">
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                </td>
                <td className="p-3 text-muted-foreground">{c.email}</td>
                <td className="p-3">{c.company}</td>
                {isAdmin && <td className="p-3"><Badge variant="outline">{c.owner.fullName}</Badge></td>}
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>Excluir</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data.total} contatos</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/contacts?page=${page - 1}`)}>
              Anterior
            </Button>
          )}
          {page < data.pages && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/contacts?page=${page + 1}`)}>
              Próxima
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create contact form component**

```tsx
// src/components/contacts/contact-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { contactSchema } from "@/lib/validations"
import { createContact } from "@/actions/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Form = z.infer<typeof contactSchema>

export function ContactForm({ isAdmin, onSuccess, defaultOwnerId }: { isAdmin: boolean; onSuccess: () => void; defaultOwnerId?: string }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(contactSchema),
    defaultValues: { ownerId: defaultOwnerId ?? "" },
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => v && fd.append(k, v))
    const result = await createContact(fd)
    if (result?.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <h2 className="font-semibold text-lg">Novo contato</h2>
      <div>
        <Label>Nome *</Label>
        <Input {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Email</Label>
          <Input {...register("email")} type="email" />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input {...register("phone")} />
        </div>
      </div>
      <div>
        <Label>Empresa</Label>
        <Input {...register("company")} />
      </div>
      {isAdmin && (
        <div>
          <Label>Responsável (user ID) *</Label>
          <Input {...register("ownerId")} placeholder="uuid do usuário" />
          {errors.ownerId && <p className="text-xs text-destructive">{errors.ownerId.message}</p>}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : "Criar contato"}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Create contact detail page**

```tsx
// src/app/(dashboard)/contacts/[id]/page.tsx
import { auth } from "@/auth"
import { getContact } from "@/actions/contacts"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InteractionForm } from "@/components/interactions/interaction-form"

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const { id } = await params
  const contact = await getContact(id)

  if (!contact) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{contact.name}</h1>
        <p className="text-muted-foreground">{contact.company}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="font-medium">Email:</span> {contact.email}</div>
        <div><span className="font-medium">Telefone:</span> {contact.phone}</div>
        <div><span className="font-medium">Responsável:</span> {contact.owner.fullName}</div>
      </div>

      <Card>
        <CardHeader><CardTitle>Deals</CardTitle></CardHeader>
        <CardContent>
          {contact.deals.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum deal.</p>
          ) : (
            <ul className="space-y-2">
              {contact.deals.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span>{d.title}</span>
                  <Badge>{d.stage}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico de Interações</CardTitle>
          <InteractionForm contactId={id} ownerId={contact.ownerId} />
        </CardHeader>
        <CardContent>
          {contact.interactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma interação registrada.</p>
          ) : (
            <ul className="space-y-3">
              {contact.interactions.map((i) => (
                <li key={i.id} className="border-l-2 pl-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i.type}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(i.date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {i.notes && <p>{i.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/contacts/ src/components/contacts/
git commit -m "feat: add contacts list page, detail page, and create form"
```

---

### Task 13: Interactions actions + form

**Files:**
- Create: `src/actions/interactions.ts`, `src/components/interactions/interaction-form.tsx`

- [ ] **Step 1: Create interactions actions**

```typescript
// src/actions/interactions.ts
"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { interactionSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

export async function createInteraction(data: {
  contactId: string
  ownerId: string
  type: string
  notes?: string
  date: string
}) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const parsed = interactionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Validate ownership: verify contact exists and belongs to the given owner
  const contact = await prisma.contact.findFirst({
    where: {
      id: parsed.data.contactId,
      ownerId: data.ownerId,
    },
  })
  if (!contact) return { error: "Contato não encontrado ou sem permissão." }

  // owner_id of interaction must equal contact owner_id
  await prisma.interaction.create({
    data: {
      contactId: parsed.data.contactId,
      ownerId: contact.ownerId,
      type: parsed.data.type as "call" | "email" | "meeting" | "note",
      notes: parsed.data.notes ?? null,
      date: new Date(parsed.data.date),
    },
  })

  revalidatePath(`/contacts/${parsed.data.contactId}`)
  return { success: true }
}

export async function deleteInteraction(id: string, contactId: string) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const where =
    session.user.role === "admin"
      ? { id }
      : { id, ownerId: session.user.id }

  const interaction = await prisma.interaction.findFirst({ where })
  if (!interaction) return { error: "Interação não encontrada." }

  await prisma.interaction.delete({ where: { id } })
  revalidatePath(`/contacts/${contactId}`)
  return { success: true }
}
```

- [ ] **Step 2: Create interaction form**

```tsx
// src/components/interactions/interaction-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createInteraction } from "@/actions/interactions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { interactionSchema } from "@/lib/validations"

type Form = z.infer<typeof interactionSchema>

export function InteractionForm({ contactId, ownerId }: { contactId: string; ownerId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(interactionSchema),
    defaultValues: { contactId, date: new Date().toISOString().slice(0, 16) },
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    const result = await createInteraction({ ...data, ownerId })
    if (result?.error) setError(result.error)
    else { setOpen(false); reset() }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">+ Interação</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <h2 className="font-semibold">Registrar Interação</h2>
          <input type="hidden" {...register("contactId")} />
          <div>
            <Label>Tipo *</Label>
            <Select onValueChange={(v) => setValue("type", v as "call" | "email" | "meeting" | "note")}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Ligação</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="note">Nota</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="datetime-local" {...register("date")} />
          </div>
          <div>
            <Label>Observações</Label>
            <Input {...register("notes")} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Registrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/interactions.ts src/components/interactions/
git commit -m "feat: add interactions actions and form with contact ownership validation"
```

---

### Task 14: Deals actions + Kanban

**Files:**
- Create: `src/actions/deals.ts`, `src/components/deals/kanban-board.tsx`, `src/components/deals/deal-card.tsx`, `src/app/(dashboard)/deals/page.tsx`

- [ ] **Step 1: Create deals actions**

```typescript
// src/actions/deals.ts
"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { dealSchema, updateDealStageSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import { DealStage } from "@prisma/client"

const OPEN_STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation"]
const STAGES: DealStage[] = [...OPEN_STAGES, "closed_won", "closed_lost"]

export async function getDeals() {
  const session = await auth()
  if (!session) throw new Error("Unauthorized")

  const where = session.user.role === "admin" ? {} : { ownerId: session.user.id }

  const deals = await prisma.deal.findMany({
    where,
    take: 50 * STAGES.length,
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { fullName: true } }, contact: { select: { name: true } } },
  })

  // Group by stage, max 50 per stage
  const grouped = Object.fromEntries(
    STAGES.map((stage) => [stage, deals.filter((d) => d.stage === stage).slice(0, 50)])
  )

  return grouped
}

export async function createDeal(data: {
  contactId: string
  title: string
  value?: number
  stage: string
}) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const parsed = dealSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Validate contact exists and is accessible
  const contact = await prisma.contact.findFirst({
    where:
      session.user.role === "admin"
        ? { id: parsed.data.contactId }
        : { id: parsed.data.contactId, ownerId: session.user.id },
  })
  if (!contact) return { error: "Contato não encontrado." }

  // owner_id must equal contact.owner_id
  await prisma.deal.create({
    data: {
      contactId: parsed.data.contactId,
      ownerId: contact.ownerId,
      title: parsed.data.title,
      value: parsed.data.value !== undefined ? parsed.data.value : null,
      stage: parsed.data.stage as DealStage,
    },
  })

  revalidatePath("/deals")
  return { success: true }
}

export async function updateDealStage(data: { dealId: string; stage: string; updatedAt: string }) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const parsed = updateDealStageSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const where =
    session.user.role === "admin" ? { id: parsed.data.dealId } : { id: parsed.data.dealId, ownerId: session.user.id }

  const deal = await prisma.deal.findFirst({ where })
  if (!deal) return { error: "Deal não encontrado." }

  const isStale = deal.updatedAt.toISOString() !== parsed.data.updatedAt

  await prisma.deal.update({
    where: { id: parsed.data.dealId },
    data: { stage: parsed.data.stage as DealStage },
  })

  revalidatePath("/deals")
  return { success: true, stale: isStale }
}

export async function deleteDeal(id: string) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const where =
    session.user.role === "admin" ? { id } : { id, ownerId: session.user.id }

  const deal = await prisma.deal.findFirst({ where })
  if (!deal) return { error: "Deal não encontrado." }

  await prisma.deal.delete({ where: { id } })
  revalidatePath("/deals")
  return { success: true }
}
```

- [ ] **Step 2: Create Kanban board component**

```tsx
// src/components/deals/kanban-board.tsx
"use client"

import { useState } from "react"
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core"
import { updateDealStage } from "@/actions/deals"
import { DealCard } from "./deal-card"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed_won: "Ganho",
  closed_lost: "Perdido",
}

type Deal = { id: string; title: string; value: unknown; stage: string; updatedAt: Date; owner: { fullName: string }; contact: { name: string } }
type Grouped = Record<string, Deal[]>

export function KanbanBoard({ initialDeals }: { initialDeals: Grouped }) {
  const [deals, setDeals] = useState<Grouped>(initialDeals)
  const { toast } = useToast()

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const newStage = over.id as string
    const dealId = active.id as string
    const currentStage = Object.keys(deals).find((s) => deals[s].some((d) => d.id === dealId))
    if (!currentStage || currentStage === newStage) return

    const deal = deals[currentStage].find((d) => d.id === dealId)!

    // Optimistic update
    setDeals((prev) => {
      const next = { ...prev }
      next[currentStage] = prev[currentStage].filter((d) => d.id !== dealId)
      next[newStage] = [...prev[newStage], { ...deal, stage: newStage }]
      return next
    })

    const result = await updateDealStage({
      dealId,
      stage: newStage,
      updatedAt: deal.updatedAt.toISOString(),
    })

    if (result?.error) {
      setDeals(initialDeals) // revert
      toast({ title: "Erro", description: result.error, variant: "destructive" })
    } else if (result?.stale) {
      toast({ title: "Aviso", description: "Este deal foi modificado por outro usuário. Sua alteração foi salva." })
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Object.entries(STAGE_LABELS).map(([stage, label]) => (
          <div
            key={stage}
            id={stage}
            className="min-w-[220px] bg-muted/40 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{label}</h3>
              <Badge variant="secondary" className="text-xs">{deals[stage]?.length ?? 0}</Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {deals[stage]?.map((deal) => (
                <DealCard key={deal.id} deal={deal} stage={stage} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  )
}
```

- [ ] **Step 3: Create deal card**

```tsx
// src/components/deals/deal-card.tsx
"use client"

import { useDraggable } from "@dnd-kit/core"
import { Card, CardContent } from "@/components/ui/card"

type Deal = { id: string; title: string; value: unknown; contact: { name: string }; owner: { fullName: string } }

export function DealCard({ deal, stage }: { deal: Deal; stage: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stage },
  })

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab ${isDragging ? "opacity-50 shadow-lg" : ""}`}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 space-y-1">
        <p className="font-medium text-sm">{deal.title}</p>
        <p className="text-xs text-muted-foreground">{deal.contact.name}</p>
        {deal.value != null && (
          <p className="text-xs text-green-600 font-medium">
            {Number(deal.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Create deals page**

```tsx
// src/app/(dashboard)/deals/page.tsx
import { getDeals } from "@/actions/deals"
import { KanbanBoard } from "@/components/deals/kanban-board"

export default async function DealsPage() {
  const deals = await getDeals()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Funil de Vendas</h1>
      <KanbanBoard initialDeals={deals} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/actions/deals.ts src/components/deals/ src/app/\(dashboard\)/deals/
git commit -m "feat: add deals kanban with drag-and-drop, last-write-wins conflict handling"
```

---

### Task 15: Dashboard stats

**Files:**
- Create: `src/components/dashboard/stats-cards.tsx` — update `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create stats cards**

```tsx
// src/components/dashboard/stats-cards.tsx
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TrendingUp, DollarSign } from "lucide-react"

export async function StatsCards() {
  const session = await auth()
  if (!session) return null

  const isAdmin = session.user.role === "admin"
  const where = isAdmin ? {} : { ownerId: session.user.id }
  const openStages = ["lead", "qualified", "proposal", "negotiation"] as const

  const [contactCount, openDeals, pipeline] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.deal.count({ where: { ...where, stage: { in: openStages } } }),
    prisma.deal.aggregate({
      where: { ...where, stage: { in: openStages } },
      _sum: { value: true },
    }),
  ])

  const total = pipeline._sum.value ? Number(pipeline._sum.value) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Contatos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{contactCount}</p>
          <p className="text-xs text-muted-foreground">{isAdmin ? "Total global" : "Seus contatos"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Deals Abertos</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{openDeals}</p>
          <p className="text-xs text-muted-foreground">{isAdmin ? "Total global" : "Seus deals"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pipeline Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-xs text-muted-foreground">Deals não fechados</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Update dashboard page**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
import { StatsCards } from "@/components/dashboard/stats-cards"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <StatsCards />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ src/app/\(dashboard\)/dashboard/
git commit -m "feat: add dashboard stats cards scoped by role"
```

---

## Phase 5 — User Management

### Task 16: Profile page

**Files:**
- Create: `src/actions/profile.ts`, `src/app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Create profile actions**

```typescript
// src/actions/profile.ts
"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { profileSchema, changePasswordSchema } from "@/lib/validations"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { fullName: parsed.data.fullName },
  })

  revalidatePath("/profile")
  return { success: true }
}

export async function changePassword(formData: FormData) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.passwordHash) return { error: "Usuário inválido." }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) return { error: "Senha atual incorreta." }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } })

  return { success: true }
}
```

- [ ] **Step 2: Create profile page**

```tsx
// src/app/(dashboard)/profile/page.tsx
import { auth } from "@/auth"
import { updateProfile, changePassword } from "@/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ProfilePage() {
  const session = await auth()

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>

      <Card>
        <CardHeader><CardTitle>Dados pessoais</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProfile} className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input name="fullName" defaultValue={session?.user.name ?? ""} required minLength={1} maxLength={100} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={session?.user.email ?? ""} disabled />
            </div>
            <Button type="submit">Salvar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alterar senha</CardTitle></CardHeader>
        <CardContent>
          <form action={changePassword} className="space-y-3">
            <div>
              <Label>Senha atual</Label>
              <Input name="currentPassword" type="password" required />
            </div>
            <div>
              <Label>Nova senha</Label>
              <Input name="newPassword" type="password" required />
            </div>
            <div>
              <Label>Confirmar nova senha</Label>
              <Input name="confirmPassword" type="password" required />
            </div>
            <Button type="submit">Alterar senha</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/profile.ts src/app/\(dashboard\)/profile/
git commit -m "feat: add profile page with name edit and current-password-gated password change"
```

---

### Task 17: Admin user management

**Files:**
- Create: `src/actions/users.ts`, `src/app/admin/users/page.tsx`, `src/components/admin/user-list.tsx`

- [ ] **Step 1: Create admin layout**

```tsx
// src/app/admin/layout.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/dashboard")
  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create users actions**

```typescript
// src/actions/users.ts
"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createUserSchema } from "@/lib/validations"
import { createToken } from "@/lib/tokens"
import { sendEmail, inviteEmailHtml } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { Role } from "@prisma/client"

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== "admin") throw new Error("Forbidden")
  return session
}

export async function getUsers({
  page = 1,
  search = "",
  role,
  active,
}: {
  page?: number
  search?: string
  role?: string
  active?: string
}) {
  await requireAdmin()
  const pageSize = 25
  const skip = (page - 1) * pageSize
  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]
  }
  if (role === "admin" || role === "user") where.role = role
  if (active === "true") where.active = true
  if (active === "false") where.active = false

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: { id: true, fullName: true, email: true, role: true, active: true, passwordHash: true, createdAt: true },
    }),
    prisma.user.count({ where }),
  ])

  return { users, total, pages: Math.ceil(total / pageSize) }
}

export async function createUser(formData: FormData) {
  const session = await requireAdmin()
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return { error: "Email já cadastrado." }

  const user = await prisma.user.create({
    data: { fullName: parsed.data.fullName, email: parsed.data.email, role: parsed.data.role as Role },
  })

  try {
    const token = await createToken(user.id, "invite", 24 * 60 * 60 * 1000)
    const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&type=invite`
    await sendEmail({ to: user.email, subject: "Convite para o CRM", html: inviteEmailHtml(link, user.fullName) })
  } catch (e) {
    console.error("SMTP error on invite:", e)
    return { error: "Erro ao enviar email de convite. Use o botão 'Reenviar convite' para tentar novamente." }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function resendInvite(userId: string) {
  await requireAdmin()
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.passwordHash !== null) return { error: "Usuário já realizou o setup." }

  try {
    const token = await createToken(user.id, "invite", 24 * 60 * 60 * 1000)
    const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&type=invite`
    await sendEmail({ to: user.email, subject: "Convite para o CRM", html: inviteEmailHtml(link, user.fullName) })
  } catch (e) {
    console.error("SMTP error on invite resend:", e)
    return { error: "Erro ao reenviar convite." }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleUserActive(targetUserId: string) {
  const session = await requireAdmin()
  if (targetUserId === session.user.id) return { error: "Você não pode desativar sua própria conta." }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!user) return { error: "Usuário não encontrado." }

  await prisma.user.update({ where: { id: targetUserId }, data: { active: !user.active } })
  revalidatePath("/admin/users")
  return { success: true }
}

export async function changeUserRole(targetUserId: string, newRole: "admin" | "user") {
  const session = await requireAdmin()
  if (targetUserId === session.user.id) return { error: "Você não pode alterar seu próprio role." }

  await prisma.user.update({ where: { id: targetUserId }, data: { role: newRole as Role } })
  revalidatePath("/admin/users")
  return { success: true }
}
```

- [ ] **Step 3: Create admin users page**

```tsx
// src/app/admin/users/page.tsx
import { getUsers } from "@/actions/users"
import { UserList } from "@/components/admin/user-list"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; role?: string; active?: string }>
}) {
  const { page, search, role, active } = await searchParams
  const data = await getUsers({ page: Number(page ?? 1), search, role, active })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuários</h1>
      <UserList data={data} />
    </div>
  )
}
```

- [ ] **Step 4: Create user list component**

```tsx
// src/components/admin/user-list.tsx
"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toggleUserActive, changeUserRole, resendInvite, createUser } from "@/actions/users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type User = { id: string; fullName: string; email: string; role: string; active: boolean; passwordHash: string | null }
type Props = { data: { users: User[]; total: number; pages: number } }

export function UserList({ data }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    params.set("search", search)
    params.set("page", "1")
    router.push(`/admin/users?${params}`)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const result = await createUser(fd)
    if (result?.error) setError(result.error)
    else { setCreateOpen(false); setError(null) }
  }

  const page = Number(searchParams.get("page") ?? 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" variant="secondary" size="sm">Buscar</Button>
        </form>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button size="sm">Novo usuário</Button></DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <h2 className="font-semibold">Criar usuário</h2>
              <div><Label>Nome *</Label><Input name="fullName" required minLength={1} maxLength={100} /></div>
              <div><Label>Email *</Label><Input name="email" type="email" required /></div>
              <div>
                <Label>Role *</Label>
                <Select name="role" defaultValue="user">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">Criar e enviar convite</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.fullName}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                </td>
                <td className="p-3">
                  {!u.passwordHash ? (
                    <Badge variant="outline">Convite pendente</Badge>
                  ) : u.active ? (
                    <Badge variant="outline" className="text-green-600">Ativo</Badge>
                  ) : (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                </td>
                <td className="p-3 flex gap-1 justify-end">
                  {!u.passwordHash && (
                    <Button size="sm" variant="ghost" onClick={() => resendInvite(u.id)}>
                      Reenviar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggleUserActive(u.id)}>
                    {u.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => changeUserRole(u.id, u.role === "admin" ? "user" : "admin")}
                  >
                    {u.role === "admin" ? "→ user" : "→ admin"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data.total} usuários</span>
        <div className="flex gap-2">
          {page > 1 && <Button variant="outline" size="sm" onClick={() => router.push(`/admin/users?page=${page - 1}`)}>Anterior</Button>}
          {page < data.pages && <Button variant="outline" size="sm" onClick={() => router.push(`/admin/users?page=${page + 1}`)}>Próxima</Button>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Manual test — admin user management**

```
1. Login as admin → navigate to /admin/users
2. Create new user → should see "Convite pendente" badge
3. Check that resend invite button appears for pending users
4. Try changing own role → should see error
5. Try deactivating own account → should see error
6. Deactivate another user → badge changes to Inativo
```

- [ ] **Step 6: Commit**

```bash
git add src/actions/users.ts src/app/admin/ src/components/admin/
git commit -m "feat: add admin user management with invite flow, resend, deactivate/reactivate"
```

---

## Phase 6 — Production Readiness

### Task 18: Toast notifications

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: Add Toaster to root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = { title: "CRM", description: "CRM Interno" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add Toaster to root layout for global toast notifications"
```

---

### Task 19: Final manual test checklist

- [ ] **Complete smoke test**

```
AUTH:
[ ] Login válido → /dashboard
[ ] Login inválido → "Email ou senha incorretos."
[ ] Conta desativada → mesma mensagem genérica
[ ] 6+ tentativas → HTTP 429
[ ] /dashboard sem login → /login
[ ] /contacts sem login → /login
[ ] /profile sem login → /login
[ ] /admin/users sem login → /login
[ ] User tenta /admin/users → /dashboard

CONTACTS:
[ ] Criar contato (user) → aparece na lista
[ ] Buscar por nome, email, empresa, telefone
[ ] User não vê contatos de outros usuários
[ ] Admin vê todos os contatos
[ ] Abrir /contacts/[id] de contato de outro user → 404

INTERACTIONS:
[ ] Criar interação em contato próprio → aparece no histórico
[ ] Criar interação com contact_id de outro user → erro

DEALS:
[ ] Criar deal vinculado a contato → aparece no kanban
[ ] Arrastar deal para outra coluna → move com animação
[ ] Deal value negativo → erro de validação

DASHBOARD:
[ ] User vê apenas seus totais
[ ] Admin vê totais globais

PROFILE:
[ ] Editar nome → atualizado no header
[ ] Mudar senha sem senha atual → erro
[ ] Mudar senha com senha atual correta → sucesso

ADMIN:
[ ] Criar usuário → email de convite enviado
[ ] Link de convite → define senha → auto-login → /dashboard
[ ] Admin não pode alterar próprio role
[ ] Admin não pode desativar própria conta
[ ] Desativar usuário → usuário perde acesso em até 1h

HEALTH:
[ ] GET /api/health → {"status":"ok"} sem autenticação

RESET:
[ ] Solicitar reset → email enviado
[ ] Usar link → define nova senha → /login
[ ] Token expirado → mensagem de link inválido
```

- [ ] **Step 2: Final commit**

```bash
git add .
git commit -m "feat: CRM MVP complete — auth, contacts, interactions, deals kanban, admin panel"
```

---

### Task 20: Docker build + EasyPanel deploy

- [ ] **Step 1: Build Docker image locally**

```bash
docker compose build
```

Expected: Build completes without errors.

- [ ] **Step 2: Run locally with Docker**

```bash
docker compose up
```

Open http://localhost:3000 → should see login page.
Open http://localhost:3000/api/health → `{"status":"ok"}`

- [ ] **Step 3: Run database migration in container**

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

- [ ] **Step 4: EasyPanel configuration**

In EasyPanel:
1. Create new project → "Docker Compose" service
2. Paste `docker-compose.yml`
3. Set all env vars listed in `.env.example`
4. Ensure `NEXTAUTH_URL` starts with `https://`
5. Deploy

- [ ] **Step 5: Configure backup cron on VPS**

```bash
# Add to crontab (crontab -e):
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/crm-$(date +%Y%m%d).sql.gz 2>> /var/log/crm-backup.log && ls -la /backups/crm-$(date +%Y%m%d).sql.gz >> /var/log/crm-backup.log
# Keep last 7 backups:
0 3 * * * find /backups -name "crm-*.sql.gz" -mtime +7 -delete
```

- [ ] **Step 6: Final commit**

```bash
git tag v1.0.0
git commit -m "chore: ready for production deploy on EasyPanel"
```
