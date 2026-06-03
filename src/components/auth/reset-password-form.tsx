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

export function ResetPasswordForm({
  token,
  type,
}: {
  token: string
  type: "reset" | "invite"
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { token },
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    const result = await setPasswordAction({
      token: data.token,
      password: data.password,
      type,
    })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success: server redirects (no need to handle here)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          {type === "invite" ? "Criar sua senha" : "Nova senha"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("token")} />
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" {...register("password")} type="password" />
            {errors.password && (
              <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              {...register("confirmPassword")}
              type="password"
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          {error && (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{error}</p>
              <Link href="/login" className="text-sm text-primary underline">
                Voltar ao login
              </Link>
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
