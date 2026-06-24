import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { hasMinRole } from "@/lib/permissions"

const schema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "HEAD_LEADER")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (parsed.data.name) data.name = parsed.data.name
  if (parsed.data.role) data.role = parsed.data.role
  if (parsed.data.active !== undefined) data.active = parsed.data.active
  if (parsed.data.password) data.password = await bcrypt.hash(parsed.data.password, 12)

  const user = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", resource: "User", resourceId: id },
  })

  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "OWNER")) {
    return NextResponse.json({ error: "Apenas o dono pode remover usuários" }, { status: 403 })
  }

  const { id } = await params
  if (id === session.user.id) {
    return NextResponse.json({ error: "Não é possível remover sua própria conta" }, { status: 422 })
  }

  // Soft delete — deactivate
  const user = await db.user.update({
    where: { id },
    data: { active: false },
    select: { id: true },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", resource: "User", resourceId: id },
  })

  return NextResponse.json(user)
}
