import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasMinRole } from "@/lib/permissions"

const schema = z.object({
  status: z.enum(["PENDING", "ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"]).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  orderedAt: z.string().optional(),
  receivedAt: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (parsed.data.status !== undefined) data.status = parsed.data.status
  if (parsed.data.supplier !== undefined) data.supplier = parsed.data.supplier
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes
  if (parsed.data.status === "ORDERED") data.orderedAt = new Date()
  if (parsed.data.status === "RECEIVED") data.receivedAt = new Date()

  const order = await db.purchaseOrder.update({
    where: { id },
    data,
    include: { createdBy: { select: { id: true, name: true } }, items: true },
  })

  return NextResponse.json({
    ...order,
    totalValue: Number(order.totalValue),
    items: order.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const { id } = await params
  await db.purchaseOrder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
