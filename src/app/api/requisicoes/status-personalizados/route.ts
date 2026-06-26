export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasMinRole } from "@/lib/permissions"

const schema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const statuses = await db.customRequisitionStatus.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { requisitions: true } } },
  }).catch(() => [])
  return NextResponse.json(statuses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const status = await db.customRequisitionStatus.create({ data: parsed.data })
  return NextResponse.json(status, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await db.customRequisitionStatus.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
