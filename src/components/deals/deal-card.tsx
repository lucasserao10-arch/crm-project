"use client"

import { useDraggable } from "@dnd-kit/core"
import { Card, CardContent } from "@/components/ui/card"

type Deal = {
  id: string
  title: string
  value: unknown
  contact: { name: string }
  owner: { fullName: string }
  updatedAt: Date
}

export function DealCard({
  deal,
  stage,
}: {
  deal: Deal
  stage: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: deal.id,
      data: { stage, updatedAt: deal.updatedAt.toISOString() },
    })

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 50,
      }
    : undefined

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing select-none ${
        isDragging ? "opacity-50 shadow-xl" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 space-y-1">
        <p className="font-medium text-sm leading-tight">{deal.title}</p>
        <p className="text-xs text-muted-foreground">{deal.contact.name}</p>
        {deal.value != null && Number(deal.value) > 0 && (
          <p className="text-xs text-emerald-600 font-medium">
            {Number(deal.value).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
