"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, FolderKanban, User, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/deals", label: "Funil", icon: FolderKanban },
  { href: "/profile", label: "Perfil", icon: User },
]

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside className="w-56 min-h-screen border-r bg-card flex flex-col">
      <div className="p-4 font-bold text-lg border-b">CRM</div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive(href)
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
        {role === "admin" && (
          <Link
            href="/admin/users"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/admin")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            Usuários
          </Link>
        )}
      </nav>
    </aside>
  )
}
