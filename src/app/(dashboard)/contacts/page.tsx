import { auth } from "@/auth"
import { getContacts } from "@/actions/contacts"
import { ContactList } from "@/components/contacts/contact-list"

export const dynamic = "force-dynamic"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; ownerId?: string }>
}) {
  const session = await auth()
  const { page, search, ownerId } = await searchParams
  const data = await getContacts({
    page: Number(page ?? 1),
    search: search ?? "",
    ownerId,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contatos</h1>
      <ContactList
        data={data}
        isAdmin={session?.user.role === "admin"}
        userId={session!.user.id}
      />
    </div>
  )
}
