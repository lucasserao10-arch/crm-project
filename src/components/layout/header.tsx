import { auth } from "@/auth"
import { logoutAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export async function Header() {
  const session = await auth()
  const name = session?.user.name ?? ""
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U"

  return (
    <header className="h-14 border-b flex items-center justify-between px-6 bg-card">
      <div />
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{name}</span>
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" type="submit">
            Sair
          </Button>
        </form>
      </div>
    </header>
  )
}
