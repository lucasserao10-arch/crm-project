"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { deleteContact } from "@/actions/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ContactForm } from "./contact-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Contact = {
  id: string
  name: string
  email: string | null
  company: string | null
  owner: { id: string; fullName: string }
}

type Props = {
  data: { contacts: Contact[]; total: number; pages: number }
  isAdmin: boolean
  userId: string
}

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
    if (!confirm("Excluir este contato e todos os seus dados vinculados?")) return
    const result = await deleteContact(id)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Contato excluído.")
      router.refresh()
    }
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
          <Button type="submit" variant="secondary" size="sm">
            Buscar
          </Button>
        </form>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            Novo contato
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo contato</DialogTitle>
            </DialogHeader>
            <ContactForm
              isAdmin={isAdmin}
              userId={userId}
              onSuccess={() => {
                setOpen(false)
                router.refresh()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Empresa</th>
              {isAdmin && <th className="text-left p-3 font-medium">Responsável</th>}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data.contacts.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="p-6 text-center text-muted-foreground">
                  Nenhum contato encontrado.
                </td>
              </tr>
            ) : (
              data.contacts.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/50">
                  <td className="p-3">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="p-3">{c.company ?? "—"}</td>
                  {isAdmin && (
                    <td className="p-3">
                      <Badge variant="outline">{c.owner.fullName}</Badge>
                    </td>
                  )}
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(c.id)}
                    >
                      Excluir
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data.total} contato(s)</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("page", String(page - 1))
                router.push(`/contacts?${params}`)
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
                router.push(`/contacts?${params}`)
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
