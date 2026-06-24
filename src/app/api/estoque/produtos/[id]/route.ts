import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  unit: z.string().optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: true,
      movements: { orderBy: { createdAt: "desc" }, take: 20 },
      alerts: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  })

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const product = await db.product.update({
    where: { id },
    data: parsed.data,
    include: { category: true, supplier: true },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", resource: "Product", resourceId: id },
  })

  return NextResponse.json(product)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Soft delete
  const product = await db.product.update({
    where: { id },
    data: { active: false },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", resource: "Product", resourceId: id },
  })

  return NextResponse.json(product)
}
