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
  if (!session || session.user.role !== "admin") {
    throw new Error("Forbidden")
  }
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
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        active: true,
        passwordHash: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  return { users, total, pages: Math.ceil(total / pageSize) }
}

export async function createUser(formData: FormData) {
  await requireAdmin()
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) return { error: "Email já cadastrado." }

  const user = await prisma.user.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      role: parsed.data.role as Role,
    },
  })

  try {
    const token = await createToken(user.id, "invite", 24 * 60 * 60 * 1000)
    const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&type=invite`
    await sendEmail({
      to: user.email,
      subject: "Convite para o CRM",
      html: inviteEmailHtml(link, user.fullName),
    })
  } catch (e) {
    console.error("SMTP error on invite:", e)
    return {
      error:
        "Erro ao enviar email de convite. Use o botão 'Reenviar convite' para tentar novamente.",
    }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function resendInvite(userId: string) {
  await requireAdmin()

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.passwordHash !== null) {
    return { error: "Usuário já realizou o setup." }
  }

  try {
    const token = await createToken(user.id, "invite", 24 * 60 * 60 * 1000)
    const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&type=invite`
    await sendEmail({
      to: user.email,
      subject: "Convite para o CRM — novo link",
      html: inviteEmailHtml(link, user.fullName),
    })
  } catch (e) {
    console.error("SMTP error on invite resend:", e)
    return { error: "Erro ao reenviar convite." }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleUserActive(targetUserId: string) {
  const session = await requireAdmin()

  if (targetUserId === session.user.id) {
    return { error: "Você não pode desativar sua própria conta." }
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!user) return { error: "Usuário não encontrado." }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { active: !user.active },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function changeUserRole(
  targetUserId: string,
  newRole: "admin" | "user"
) {
  const session = await requireAdmin()

  if (targetUserId === session.user.id) {
    return { error: "Você não pode alterar seu próprio role." }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole as Role },
  })

  revalidatePath("/admin/users")
  return { success: true }
}
