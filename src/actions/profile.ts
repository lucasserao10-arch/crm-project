"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { profileSchema, changePasswordSchema } from "@/lib/validations"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session) return { error: "Unauthorized" }

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
  })
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
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  })

  return { success: true }
}
