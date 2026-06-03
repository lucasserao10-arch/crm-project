"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { contactSchema } from "@/lib/validations"
import { createContact } from "@/actions/contacts"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Form = z.infer<typeof contactSchema>

export function ContactForm({
  isAdmin,
  userId,
  onSuccess,
}: {
  isAdmin: boolean
  userId: string
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(contactSchema),
    defaultValues: { ownerId: userId },
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== "") fd.append(k, String(v))
    })
    const result = await createContact(fd)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Contato criado com sucesso.")
      reset()
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <Label>Nome *</Label>
        <Input {...register("name")} placeholder="Nome completo" />
        {errors.name && (
          <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Email</Label>
          <Input {...register("email")} type="email" placeholder="email@exemplo.com" />
          {errors.email && (
            <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
          )}
        </div>
        <div>
          <Label>Telefone</Label>
          <Input {...register("phone")} placeholder="(11) 99999-9999" />
        </div>
      </div>
      <div>
        <Label>Empresa</Label>
        <Input {...register("company")} placeholder="Nome da empresa" />
      </div>
      {isAdmin && (
        <div>
          <Label>ID do Responsável *</Label>
          <Input {...register("ownerId")} placeholder="UUID do usuário" />
          {errors.ownerId && (
            <p className="text-xs text-destructive mt-1">{errors.ownerId.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Cole o ID do usuário responsável por este contato.
          </p>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : "Criar contato"}
      </Button>
    </form>
  )
}
