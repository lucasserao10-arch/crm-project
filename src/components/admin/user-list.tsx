"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  createUser,
  resendInvite,
  toggleUserActive,
  changeUserRole,
} from "@/actions/users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type User = {
  id: string
  fullName: string
  email: string
  role: string
  active: boolean
  passwordHash: string | null
}

type Props = {
  data: { users: User[]; total: number; pages: number }
}

export function UserList({ data }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [roleValue, setRoleValue] = useState("user")

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    params.set("search", search)
    params.set("page", "1")
    router.push(`/admin/users?${params}`)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("role", roleValue)
    const result = await createUser(fd)
    if (result?.error) {
      setCreateError(result.error)
    } else {
      toast.success("Convite enviado.")
      setCreateOpen(false)
      router.refresh()
    }
    setCreateLoading(false)
  }

  async function handleResend(userId: string) {
    const result = await resendInvite(userId)
    if (result?.error) toast.error(result.error)
    else toast.success("Convite reenviado.")
  }

  async function handleToggle(userId: string) {
    const result = await toggleUserActive(userId)
    if (result?.error) toast.error(result.error)
    else { toast.success("Status atualizado."); router.refresh() }
  }

  async function handleRoleChange(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin"
    const result = await changeUserRole(userId, newRole)
    if (result?.error) toast.error(result.error)
    else { toast.success("Role atualizado."); router.refresh() }
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
          <Button type="submit" variant="secondary" size="sm">
            Buscar
          </Button>
        </form>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            Novo usuário
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <Label>Nome completo *</Label>
                <Input name="fullName" required minLength={1} maxLength={100} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input name="email" type="email" required />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={roleValue} onValueChange={(v) => { if (v !== null) setRoleValue(v) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <Button type="submit" className="w-full" disabled={createLoading}>
                {createLoading ? "Criando..." : "Criar e enviar convite"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data.users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              data.users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-medium">{u.fullName}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {u.passwordHash === null ? (
                      <Badge variant="outline">Convite pendente</Badge>
                    ) : u.active ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {u.passwordHash === null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResend(u.id)}
                        >
                          Reenviar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggle(u.id)}
                      >
                        {u.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRoleChange(u.id, u.role)}
                      >
                        {u.role === "admin" ? "→ user" : "→ admin"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data.total} usuário(s)</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("page", String(page - 1))
                router.push(`/admin/users?${params}`)
              }}
            >
              Anterior
            </Button>
          )}
          {page < data.pages && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("page", String(page + 1))
                router.push(`/admin/users?${params}`)
              }}
            >
              Próxima
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
