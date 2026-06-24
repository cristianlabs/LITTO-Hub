import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  productId: z.string(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]),
  quantity: z.number().int().min(1),
  reason: z.string().optional(),
  reference: z.string().optional(),
  cost: z.number().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get("productId")
  const limit = parseInt(searchParams.get("limit") ?? "50")

  const movements = await db.stockMovement.findMany({
    where: productId ? { productId } : {},
    include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json(movements)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { productId, type, quantity, reason, reference, cost } = parsed.data

  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  const delta = type === "OUT" ? -quantity : type === "ADJUSTMENT" ? quantity - product.currentStock : quantity
  const newStock = type === "ADJUSTMENT" ? quantity : product.currentStock + delta

  if (newStock < 0) {
    return NextResponse.json(
      { error: `Estoque insuficiente. Atual: ${product.currentStock} ${product.unit}` },
      { status: 422 },
    )
  }

  await db.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: { productId, type, quantity, reason, reference, cost },
    })

    await tx.product.update({
      where: { id: productId },
      data: { currentStock: newStock },
    })

    let alertType: "ZERO" | "MINIMUM" | "MAXIMUM" | null = null
    if (newStock <= 0) alertType = "ZERO"
    else if (newStock <= product.minStock) alertType = "MINIMUM"
    else if (newStock >= product.maxStock) alertType = "MAXIMUM"

    if (alertType) {
      await tx.stockAlert.create({
        data: { productId, type: alertType, value: newStock },
      })

      const managers = await tx.user.findMany({
        where: { role: { in: ["OWNER", "HEAD_LEADER", "MANAGER"] }, active: true },
        select: { id: true },
      })

      const notifType = alertType === "ZERO" ? "STOCK_ZERO" : alertType === "MINIMUM" ? "STOCK_MIN" : "STOCK_MAX"
      const titles = { ZERO: "Estoque zerado", MINIMUM: "Estoque mínimo atingido", MAXIMUM: "Estoque máximo atingido" }

      await tx.notification.createMany({
        data: managers.map((m) => ({
          userId: m.id,
          type: notifType as "STOCK_ZERO" | "STOCK_MIN" | "STOCK_MAX",
          title: titles[alertType!],
          message: `"${product.name}" — estoque atual: ${newStock} ${product.unit}`,
          link: "/estoque",
        })),
      })
    }
  })

  return NextResponse.json({ success: true, newStock })
}
