import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { hasMinRole } from "@/lib/permissions"
import { ALL_MODULES, DEFAULT_PERMISSIONS } from "@/lib/module-permissions"
import type { Role } from "@prisma/client"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const saved = await db.modulePermission.findMany()

  // Build matrix: module -> Set of allowed roles
  const matrix: Record<string, Role[]> = {}

  for (const mod of ALL_MODULES) {
    const savedRoles = saved.filter((p) => p.module === mod.key).map((p) => p.role as Role)
    // If no records saved yet for this module, return defaults
    matrix[mod.key] = savedRoles.length > 0 ? savedRoles : DEFAULT_PERMISSIONS[mod.key] ?? []
  }

  return NextResponse.json(matrix)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role as Role, "OWNER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body: Record<string, Role[]> = await req.json()

  // Delete all and re-insert
  await db.modulePermission.deleteMany()

  const records = Object.entries(body).flatMap(([module, roles]) =>
    roles.map((role) => ({ module, role }))
  )

  await db.modulePermission.createMany({ data: records, skipDuplicates: true })

  return NextResponse.json({ ok: true })
}
