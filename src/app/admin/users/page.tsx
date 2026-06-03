import { getUsers } from "@/actions/users"
import { UserList } from "@/components/admin/user-list"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; role?: string; active?: string }>
}) {
  const { page, search, role, active } = await searchParams
  const data = await getUsers({
    page: Number(page ?? 1),
    search: search ?? "",
    role,
    active,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuários</h1>
      <UserList data={data} />
    </div>
  )
}
