import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

const prisma = new PrismaClient()

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[a-zA-Z]/, "Deve conter pelo menos 1 letra")
  .regex(/[0-9]/, "Deve conter pelo menos 1 número")

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set")
  }

  const emailValidation = z.string().email().safeParse(email)
  if (!emailValidation.success) {
    throw new Error(`SEED_ADMIN_EMAIL is not a valid email: ${email}`)
  }

  const passwordValidation = passwordSchema.safeParse(password)
  if (!passwordValidation.success) {
    throw new Error(
      `SEED_ADMIN_PASSWORD is too weak: ${passwordValidation.error.issues[0].message}`
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin ${email} already exists — skipping seed.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      fullName: "Admin",
      email,
      passwordHash,
      role: "admin",
    },
  })

  console.log(`Admin ${email} created successfully.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
