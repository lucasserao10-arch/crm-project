"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { dealSchema, updateDealStageSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import { DealStage } from "@prisma/client"

const STAGES: DealStage[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
]

async function requireSession() {
  const session = await auth()
  if (!session) throw new Error("Unauthorized")
  return session
}

export async function getDeals() {
  const session = await requireSession()
  const where =
    session.user.role === "admin" ? {} : { ownerId: session.user.id }

  const results = await Promise.all(
    STAGES.map((stage) =>
      prisma.deal.findMany({
        where: { ...where, stage },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          owner: { select: { fullName: true } },
          contact: { select: { name: true } },
        },
      })
    )
  )

  const grouped = Object.fromEntries(
    STAGES.map((stage, i) => [stage, results[i]])
  ) as Record<DealStage, (typeof results)[0]>

  return grouped
}

export async function createDeal(data: {
  contactId: string
  title: string
  value?: number
  stage: string
}) {
  const session = await requireSession()

  const parsed = dealSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Verify contact exists and is accessible
  const contactWhere =
    session.user.role === "admin"
      ? { id: parsed.data.contactId }
      : { id: parsed.data.contactId, ownerId: session.user.id }

  const contact = await prisma.contact.findFirst({ where: contactWhere })
  if (!contact) return { error: "Contato não encontrado." }

  // deal.owner_id MUST equal contact.owner_id
  await prisma.deal.create({
    data: {
      contactId: parsed.data.contactId,
      ownerId: contact.ownerId,
      title: parsed.data.title,
      value:
        parsed.data.value !== undefined ? parsed.data.value : null,
      stage: parsed.data.stage as DealStage,
    },
  })

  revalidatePath("/deals")
  return { success: true }
}

export async function updateDealStage(data: {
  dealId: string
  stage: string
  updatedAt: string
}) {
  const session = await requireSession()

  const parsed = updateDealStageSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const where =
    session.user.role === "admin"
      ? { id: parsed.data.dealId }
      : { id: parsed.data.dealId, ownerId: session.user.id }

  const deal = await prisma.deal.findFirst({ where })
  if (!deal) return { error: "Deal não encontrado." }

  // Detect stale write (last-write-wins — we still proceed)
  const isStale =
    deal.updatedAt.toISOString() !== parsed.data.updatedAt

  await prisma.deal.update({
    where: { id: parsed.data.dealId },
    data: { stage: parsed.data.stage as DealStage },
  })

  revalidatePath("/deals")
  return { success: true, stale: isStale }
}

export async function deleteDeal(id: string) {
  const session = await requireSession()

  const where =
    session.user.role === "admin"
      ? { id }
      : { id, ownerId: session.user.id }

  const deal = await prisma.deal.findFirst({ where })
  if (!deal) return { error: "Deal não encontrado." }

  await prisma.deal.delete({ where: { id } })
  revalidatePath("/deals")
  return { success: true }
}
