"use client"

import { useState } from "react"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import { toast } from "sonner"
import { updateDealStage } from "@/actions/deals"
import { DealCard } from "./deal-card"
import { Badge } from "@/components/ui/badge"

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed_won: "Ganho",
  closed_lost: "Perdido",
}

const STAGES = Object.keys(STAGE_LABELS)

type Deal = {
  id: string
  title: string
  value: unknown
  stage: string
  updatedAt: Date
  owner: { fullName: string }
  contact: { name: string }
}

type Grouped = Record<string, Deal[]>

function KanbanColumn({
  stage,
  deals,
}: {
  stage: string
  deals: Deal[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[220px] max-w-[220px] rounded-lg p-3 space-y-2 transition-colors ${
        isOver ? "bg-accent" : "bg-muted/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{STAGE_LABELS[stage]}</h3>
        <Badge variant="secondary" className="text-xs">
          {deals.length}
          {deals.length === 50 ? "+" : ""}
        </Badge>
      </div>
      <div className="space-y-2 min-h-[80px]">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} stage={stage} />
        ))}
      </div>
    </div>
  )
}

export function KanbanBoard({ initialDeals }: { initialDeals: Grouped }) {
  const [deals, setDeals] = useState<Grouped>(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const activeDeal = activeId
    ? Object.values(deals)
        .flat()
        .find((d) => d.id === activeId)
    : null

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const newStage = over.id as string
    const dealId = active.id as string
    const dealUpdatedAt = (active.data.current as { updatedAt: string })
      ?.updatedAt

    if (!STAGES.includes(newStage)) return

    const currentStage = Object.keys(deals).find((s) =>
      deals[s].some((d) => d.id === dealId)
    )
    if (!currentStage || currentStage === newStage) return

    const deal = deals[currentStage].find((d) => d.id === dealId)!

    // Optimistic update
    setDeals((prev) => {
      const next = { ...prev }
      next[currentStage] = prev[currentStage].filter((d) => d.id !== dealId)
      next[newStage] = [...prev[newStage], { ...deal, stage: newStage }]
      return next
    })

    const result = await updateDealStage({
      dealId,
      stage: newStage,
      updatedAt: dealUpdatedAt ?? deal.updatedAt.toISOString(),
    })

    if (result?.error) {
      // Revert on error
      setDeals(initialDeals)
      toast.error(result.error)
    } else if (result?.stale) {
      toast.warning(
        "Este deal foi modificado por outro usuário. Sua alteração foi salva."
      )
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn key={stage} stage={stage} deals={deals[stage] ?? []} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal && (
          <DealCard deal={activeDeal} stage={activeDeal.stage} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
