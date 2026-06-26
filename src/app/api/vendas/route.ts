import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const postSchema = z.object({
  title: z.string().min(1),
  pipelineId: z.string(),
  contactId: z.string().optional(),
  sellerId: z.string().optional(),
  expectedClose: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
  })).optional(),
})

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["OPEN", "WON", "LOST"]).optional(),
  value: z.number().optional(),
  sellerId: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
})

const dealInclude = {
  contact: { select: { id: true, name: true } },
  pipeline: { select: { id: true, name: true, color: true } },
  seller: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
  },
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? ""
  const sellerId = searchParams.get("sellerId") ?? ""
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const q = searchParams.get("q") ?? ""

  const deals = await db.deal.findMany({
    where: {
      ...(status ? { status: status as "OPEN" | "WON" | "LOST" } : {}),
      ...(sellerId ? { sellerId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
        },
      } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: dealInclude,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(deals.map((d) => ({
    ...d,
    value: d.value ? Number(d.value) : null,
    items: d.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { title, pipelineId, contactId, sellerId, expectedClose, items } = parsed.data

  // Calculate total from items if provided
  const totalValue = items?.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) ?? null

  const deal = await db.deal.create({
    data: {
      title,
      pipelineId,
      contactId: contactId ?? null,
      sellerId: sellerId ?? null,
      expectedClose: expectedClose ? new Date(expectedClose) : null,
      value: totalValue,
      items: items?.length
        ? {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          }
        : undefined,
    },
    include: dealInclude,
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", resource: "Deal", resourceId: deal.id },
  })

  return NextResponse.json({
    ...deal,
    value: deal.value ? Number(deal.value) : null,
    items: deal.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, status, value, sellerId, closedAt } = parsed.data

  const data: Record<string, unknown> = {}
  if (status !== undefined) {
    data.status = status
    if (status === "WON" || status === "LOST") data.closedAt = new Date()
    if (status === "OPEN") data.closedAt = null
  }
  if (value !== undefined) data.value = value
  if (sellerId !== undefined) data.sellerId = sellerId
  if (closedAt !== undefined) data.closedAt = closedAt ? new Date(closedAt) : null

  const prevDeal = await db.deal.findUnique({ where: { id }, select: { status: true } })

  const deal = await db.deal.update({
    where: { id },
    data,
    include: dealInclude,
  })

  // When deal is won for the first time, deduct stock for each item
  if (status === "WON" && prevDeal?.status !== "WON" && deal.items.length > 0) {
    await db.$transaction(async (tx) => {
      for (const item of deal.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { currentStock: true, name: true },
        })
        if (!product) continue
        if (product.currentStock < item.quantity) {
          throw new Error(`Estoque insuficiente para "${product.name}" (disponível: ${product.currentStock})`)
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        })
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "OUT",
            quantity: item.quantity,
            reason: `Venda: ${deal.title}`,
            reference: deal.id,
            cost: item.unitPrice,
          },
        })
      }
    })
  }

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", resource: "Deal", resourceId: id },
  })

  return NextResponse.json({
    ...deal,
    value: deal.value ? Number(deal.value) : null,
    items: deal.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  })
}
