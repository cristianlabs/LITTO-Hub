import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  cnpj: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  contact: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  })
  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supplier = await db.supplier.create({
    data: { ...parsed.data, email: parsed.data.email || null },
  })
  return NextResponse.json(supplier, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, ...data } = await req.json()
  const supplier = await db.supplier.update({
    where: { id },
    data: { ...data, email: data.email || null },
  })
  return NextResponse.json(supplier)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await db.supplier.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
