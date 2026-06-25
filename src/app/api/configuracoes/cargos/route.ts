import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Role } from "@prisma/client"

const VALID_ROLES: Role[] = ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]

const schema = z.object({
  name: z.string().min(1).max(60),
  baseRole: z.enum(["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#6B7280"),
  description: z.string().max(200).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cargos = await db.customRole.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  })

  return NextResponse.json(cargos)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "OWNER")
    return NextResponse.json({ error: "Apenas o proprietário pode criar cargos" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const cargo = await db.customRole.create({ data: parsed.data })
  return NextResponse.json(cargo, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "OWNER")
    return NextResponse.json({ error: "Apenas o proprietário pode editar cargos" }, { status: 403 })

  const body = await req.json()
  const { id, ...rest } = body

  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  const parsed = schema.partial().safeParse(rest)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const cargo = await db.customRole.update({ where: { id }, data: parsed.data })
  return NextResponse.json(cargo)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "OWNER")
    return NextResponse.json({ error: "Apenas o proprietário pode excluir cargos" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  // Remove customRoleId from users before deleting
  await db.user.updateMany({ where: { customRoleId: id }, data: { customRoleId: null } })
  await db.customRole.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}

// PATCH /api/configuracoes/cargos/atribuir — assign a customRole to a user
export { VALID_ROLES }
