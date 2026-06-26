import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  unit: z.string().optional(),
  currentStock: z.number().int().optional(),
  minStock: z.number().int().optional(),
  maxStock: z.number().int().optional(),
})

const movementSchema = z.object({
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
  const filter = searchParams.get("filter")

  const products = await db.product.findMany({
    where: {
      active: true,
      ...(filter === "zero" ? { currentStock: 0 } : {}),
      ...(filter === "min" ? { currentStock: { gt: 0 }, minStock: { gt: 0 } } : {}),
    },
    include: { category: true, supplier: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(products.map((p) => ({
    ...p,
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Check if this is a movement request
  if ("productId" in body && "type" in body && "quantity" in body) {
    const parsed = movementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { productId, type, quantity, reason, reference, cost } = parsed.data

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const delta = type === "OUT" ? -quantity : quantity
    const newStock = product.currentStock + delta

    if (newStock < 0)
      return NextResponse.json({ error: "Estoque insuficiente para esta saída" }, { status: 422 })

    await db.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: { productId, type, quantity, reason, reference, cost },
      })

      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      })

      // Determine alert type
      let alertType: "ZERO" | "MINIMUM" | "MAXIMUM" | null = null
      if (newStock <= 0) alertType = "ZERO"
      else if (newStock <= product.minStock) alertType = "MINIMUM"
      else if (newStock >= product.maxStock) alertType = "MAXIMUM"

      if (alertType) {
        await tx.stockAlert.create({
          data: { productId, type: alertType, value: newStock },
        })

        // Notify managers+
        const managers = await tx.user.findMany({
          where: { role: { in: ["OWNER", "HEAD_LEADER", "MANAGER"] }, active: true },
          select: { id: true },
        })

        const notifType =
          alertType === "ZERO"
            ? ("STOCK_ZERO" as const)
            : alertType === "MINIMUM"
              ? ("STOCK_MIN" as const)
              : ("STOCK_MAX" as const)

        const titles: Record<string, string> = {
          ZERO: "Estoque zerado",
          MINIMUM: "Estoque mínimo atingido",
          MAXIMUM: "Estoque máximo atingido",
        }

        await tx.notification.createMany({
          data: managers.map((m) => ({
            userId: m.id,
            type: notifType,
            title: titles[alertType!],
            message: `Produto "${product.name}" com estoque: ${newStock} ${product.unit}`,
            link: "/estoque",
          })),
        })
      }
    })

    return NextResponse.json({ success: true, newStock })
  }

  // Otherwise create product
  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const product = await db.product.create({ data: parsed.data })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      resource: "Product",
      resourceId: product.id,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
