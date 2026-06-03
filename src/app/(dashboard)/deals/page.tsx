import { getDeals } from "@/actions/deals"
import { KanbanBoard } from "@/components/deals/kanban-board"

export default async function DealsPage() {
  const deals = await getDeals()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Funil de Vendas</h1>
      <KanbanBoard initialDeals={deals} />
    </div>
  )
}
