"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { contactSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

async function requireSession() {
  const session = await auth()
  if (!session) throw new Error("Unauthorized")
  return session
}

function buildContactWhere(
  session: Awaited<ReturnType<typeof requireSession>>,
  extra: Record<string, unknown> = {}
) {
  const where: Record<string, unknown> = { ...extra }
  if (session.user.role !== "admin") {
    where.ownerId = session.user.id
  }
  return where
}

export async function getContacts({
  page = 1,
  search = "",
  ownerId,
}: {
  page?: number
  search?: string
  ownerId?: string
}) {
  const session = await requireSession()
  const pageSize = 25
  const skip = (page - 1) * pageSize

  const where = buildContactWhere(session)

  if (search) {
    (where as Record<string, unknown>).OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ]
  }

  // Admin-only owner filter
  if (ownerId && session.user.role === "admin") {
    where.ownerId = ownerId
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      include: { owner: { select: { id: true, fullName: true } } },
    }),
    prisma.contact.count({ where }),
  ])

  return { contacts, total, pages: Math.ceil(total / pageSize) }
}

export async function getContact(id: string) {
  const session = await requireSession()
  const where = buildContactWhere(session, { id })

  const contact = await prisma.contact.findFirst({
    where,
    include: {
      owner: { select: { id: true, fullName: true } },
      interactions: { orderBy: { date: "desc" } },
      deals: { orderBy: { createdAt: "desc" } },
    },
  })

  return contact // null if not found or not accessible
}

export async function createContact(formData: FormData) {
  const session = await requireSession()
  const raw = Object.fromEntries(formData)

  // User always gets their own id as owner
  if (session.user.role !== "admin") {
    raw.ownerId = session.user.id
  }

  const parsed = contactSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await prisma.contact.create({ data: parsed.data })
  revalidatePath("/contacts")
  return { success: true }
}

export async function updateContact(id: string, formData: FormData) {
  const session = await requireSession()
  const where = buildContactWhere(session, { id })

  const contact = await prisma.contact.findFirst({ where })
  if (!contact) return { error: "Contato não encontrado." }

  const raw = Object.fromEntries(formData)
  // owner_id is IMMUTABLE — always use the existing value, never trust the payload
  raw.ownerId = contact.ownerId

  const parsed = contactSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await prisma.contact.update({ where: { id }, data: parsed.data })
  revalidatePath("/contacts")
  revalidatePath(`/contacts/${id}`)
  return { success: true }
}

export async function deleteContact(id: string) {
  const session = await requireSession()
  const where = buildContactWhere(session, { id })

  const contact = await prisma.contact.findFirst({ where })
  if (!contact) return { error: "Contato não encontrado." }

  // Cascade delete of interactions and deals is handled by DB (onDelete: Cascade)
  await prisma.contact.delete({ where: { id } })
  revalidatePath("/contacts")
  return { success: true }
}
