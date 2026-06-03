import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TrendingUp, DollarSign } from "lucide-react"

const OPEN_STAGES = ["lead", "qualified", "proposal", "negotiation"] as const

export async function StatsCards() {
  const session = await auth()
  if (!session) return null

  const isAdmin = session.user.role === "admin"
  const where = isAdmin ? {} : { ownerId: session.user.id }

  const [contactCount, openDeals, pipeline] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.deal.count({
      where: { ...where, stage: { in: [...OPEN_STAGES] } },
    }),
    prisma.deal.aggregate({
      where: { ...where, stage: { in: [...OPEN_STAGES] } },
      _sum: { value: true },
    }),
  ])

  const total = pipeline._sum.value ? Number(pipeline._sum.value) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Contatos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{contactCount}</p>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Total global" : "Seus contatos"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Deals Abertos</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{openDeals}</p>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Total global" : "Seus deals"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Pipeline Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {total.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
          <p className="text-xs text-muted-foreground">Deals não fechados</p>
        </CardContent>
      </Card>
    </div>
  )
}
