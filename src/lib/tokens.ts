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
      where: { userId, type, usedAt: null },
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

export async function consumeToken(tokenId: string, userId: string, type: TokenType) {
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    })
    await tx.passwordResetToken.deleteMany({
      where: { userId, type, usedAt: null },
    })
  })
}
