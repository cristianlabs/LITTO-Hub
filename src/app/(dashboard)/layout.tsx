import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Sidebar } from "@/components/layout/sidebar"
import { ALL_MODULES, DEFAULT_PERMISSIONS } from "@/lib/module-permissions"
import type { Role } from "@prisma/client"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const userRole = session.user.role as Role

  let allowedModules: string[]

  if (userRole === "OWNER") {
    allowedModules = ALL_MODULES.map((m) => m.key)
  } else {
    const saved = await db.modulePermission.findMany()
    allowedModules = ALL_MODULES.filter((mod) => {
      const roles = saved.filter((p) => p.module === mod.key).map((p) => p.role as Role)
      const effective = roles.length > 0 ? roles : (DEFAULT_PERMISSIONS[mod.key] ?? [])
      return effective.includes(userRole)
    }).map((m) => m.key)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar allowedModules={allowedModules} />
      <main className="flex-1 flex flex-col overflow-y-auto">{children}</main>
    </div>
  )
}
