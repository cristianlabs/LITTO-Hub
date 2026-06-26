import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasMinRole } from "@/lib/permissions"

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1),
  unit: z.string().default("un"),
  unitPrice: z.number().min(0),
})

const schema = z.object({
  title: z.string().min(1),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  requisitionId: z.string().optional(),
  items: z.array(itemSchema).min(1, "Adicione ao menos um item"),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const orders = await db.purchaseOrder.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      requisition: { select: { id: true, title: true, status: true } },
      items: true,
    },
  })

  return NextResponse.json(orders.map((o) => ({
    ...o,
    totalValue: Number(o.totalValue),
    items: o.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const totalValue = parsed.data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  // Generate unique order number inside a transaction to avoid race conditions
  const order = await db.$transaction(async (tx) => {
    const count = await tx.purchaseOrder.count()
    const number = `PC-${String(count + 1).padStart(4, "0")}`
    return tx.purchaseOrder.create({
      data: {
        number,
        title: parsed.data.title,
        supplier: parsed.data.supplier,
        notes: parsed.data.notes,
        totalValue,
        createdById: session.user.id,
        requisitionId: parsed.data.requisitionId || null,
        items: { create: parsed.data.items },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        items: true,
      },
    })
  })

  // Mark requisition as DONE if linked
  if (parsed.data.requisitionId) {
    await db.requisition.update({
      where: { id: parsed.data.requisitionId },
      data: { status: "DONE" },
    })
  }

  return NextResponse.json({
    ...order,
    totalValue: Number(order.totalValue),
    items: order.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  }, { status: 201 })
}
