"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { interactionSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import { InteractionType } from "@prisma/client"

async function requireSession() {
  const session = await auth()
  if (!session) throw new Error("Unauthorized")
  return session
}

export async function createInteraction(data: {
  contactId: string
  ownerId: string
  type: string
  notes?: string
  date: string
}) {
  const session = await requireSession()

  const parsed = interactionSchema.safeParse({
    contactId: data.contactId,
    type: data.type,
    notes: data.notes,
    date: data.date,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Validate: contact must exist and be owned by the provided ownerId
  // This enforces interaction.owner_id === contact.owner_id
  const contact = await prisma.contact.findFirst({
    where: {
      id: parsed.data.contactId,
      ownerId: data.ownerId,
    },
  })
  if (!contact) return { error: "Contato não encontrado ou sem permissão." }

  // For regular users: also verify they own the contact
  if (session.user.role !== "admin" && contact.ownerId !== session.user.id) {
    return { error: "Sem permissão para registrar interações neste contato." }
  }

  await prisma.interaction.create({
    data: {
      contactId: parsed.data.contactId,
      ownerId: contact.ownerId, // MUST equal contact.ownerId
      type: parsed.data.type as InteractionType,
      notes: parsed.data.notes || null,
      date: new Date(parsed.data.date),
    },
  })

  revalidatePath(`/contacts/${parsed.data.contactId}`)
  return { success: true }
}

export async function deleteInteraction(id: string, contactId: string) {
  const session = await requireSession()

  const where =
    session.user.role === "admin"
      ? { id }
      : { id, ownerId: session.user.id }

  const interaction = await prisma.interaction.findFirst({ where })
  if (!interaction) return { error: "Interação não encontrada." }

  await prisma.interaction.delete({ where: { id } })
  revalidatePath(`/contacts/${contactId}`)
  return { success: true }
}
