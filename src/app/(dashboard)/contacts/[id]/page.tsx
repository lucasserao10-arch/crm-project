import { auth } from "@/auth"
import { getContact } from "@/actions/contacts"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InteractionForm } from "@/components/interactions/interaction-form"

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getContact(id)

  if (!contact) notFound()

  const stageLabel: Record<string, string> = {
    lead: "Lead",
    qualified: "Qualificado",
    proposal: "Proposta",
    negotiation: "Negociação",
    closed_won: "Ganho",
    closed_lost: "Perdido",
  }

  const interactionLabel: Record<string, string> = {
    call: "Ligação",
    email: "Email",
    meeting: "Reunião",
    note: "Nota",
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{contact.name}</h1>
        {contact.company && (
          <p className="text-muted-foreground">{contact.company}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm border rounded-md p-4">
        <div>
          <span className="font-medium">Email:</span>{" "}
          {contact.email ?? "—"}
        </div>
        <div>
          <span className="font-medium">Telefone:</span>{" "}
          {contact.phone ?? "—"}
        </div>
        <div>
          <span className="font-medium">Responsável:</span>{" "}
          {contact.owner.fullName}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deals</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.deals.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum deal vinculado.</p>
          ) : (
            <ul className="space-y-2">
              {contact.deals.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span>{d.title}</span>
                  <Badge variant="outline">
                    {stageLabel[d.stage] ?? d.stage}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Histórico de Interações</CardTitle>
          <InteractionForm
            contactId={contact.id}
            ownerId={contact.ownerId}
          />
        </CardHeader>
        <CardContent>
          {contact.interactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma interação registrada.
            </p>
          ) : (
            <ul className="space-y-3">
              {contact.interactions.map((i) => (
                <li key={i.id} className="border-l-2 border-primary/30 pl-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {interactionLabel[i.type] ?? i.type}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(i.date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {i.notes && <p className="text-muted-foreground">{i.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
