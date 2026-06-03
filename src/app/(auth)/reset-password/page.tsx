import { validateToken } from "@/lib/tokens"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import Link from "next/link"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; type?: string }>
}) {
  const { token, type } = await searchParams

  // No token in URL
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">
            Este link é inválido ou já foi utilizado.
          </p>
          <Link href="/login" className="text-primary underline text-sm">
            Voltar ao login
          </Link>
        </div>
      </main>
    )
  }

  const tokenType = type === "invite" ? "invite" : "reset"

  // Validate token server-side before rendering form
  const result = await validateToken(token, tokenType)

  if (!result.valid) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">
            Este link é inválido ou já foi utilizado.
          </p>
          <Link href="/login" className="text-primary underline text-sm">
            Voltar ao login
          </Link>
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
