"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createInteraction } from "@/actions/interactions"
import { interactionSchema } from "@/lib/validations"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Form = z.infer<typeof interactionSchema>

export function InteractionForm({
  contactId,
}: {
  contactId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      contactId,
      date: localISOTime,
    },
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    const result = await createInteraction({
      contactId: data.contactId,
      type: data.type,
      notes: data.notes,
      date: data.date,
    })
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Interação registrada.")
      setOpen(false)
      reset()
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        + Interação
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Interação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <input type="hidden" {...register("contactId")} />
          <div>
            <Label>Tipo *</Label>
            <Select
              onValueChange={(v) =>
                setValue("type", v as "call" | "email" | "meeting" | "note")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Ligação</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="note">Nota</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-destructive mt-1">{errors.type.message}</p>
            )}
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="datetime-local" {...register("date")} />
            {errors.date && (
              <p className="text-xs text-destructive mt-1">{errors.date.message}</p>
            )}
          </div>
          <div>
            <Label>Observações</Label>
            <Input {...register("notes")} placeholder="Notas sobre a interação..." />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Registrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
