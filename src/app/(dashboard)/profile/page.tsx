"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateProfile, changePassword } from "@/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Note: We use a client component here to show toasts. The session data
// is passed as props from a server wrapper or we read from a form.

export default function ProfilePage() {
  const router = useRouter()
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  async function handleProfileUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await updateProfile(fd)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Perfil atualizado.")
      router.refresh()
    }
    setProfileLoading(false)
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await changePassword(fd)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Senha alterada com sucesso.")
      ;(e.target as HTMLFormElement).reset()
    }
    setPasswordLoading(false)
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-3">
            <div>
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                name="fullName"
                required
                minLength={1}
                maxLength={100}
              />
            </div>
            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
              />
            </div>
            <div>
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
              />
            </div>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
