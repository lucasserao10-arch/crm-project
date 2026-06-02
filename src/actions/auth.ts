"use server"

import { signIn, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { loginLimiter, resetLimiter } from "@/lib/rate-limit"
import { sendEmail, resetPasswordEmailHtml } from "@/lib/email"
import { createToken, validateToken, consumeToken } from "@/lib/tokens"
import { resetPasswordRequestSchema, passwordSchema } from "@/lib/validations"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export async function loginAction(formData: FormData) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? "anonymous"
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
    const msg = String((e as Error).message ?? "")
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
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? "anonymous"
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

export async function setPasswordAction(data: {
  token: string
  password: string
  type: "reset" | "invite"
}) {
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

  await consumeToken(token.id, token.userId, data.type)

  if (data.type === "reset") {
    await signOut({ redirect: false })
    redirect("/login")
  }

  // For invite: auto-login then redirect to /dashboard
  await signIn("credentials", {
    email: token.user.email,
    password: data.password,
    redirectTo: "/dashboard",
  })
}
