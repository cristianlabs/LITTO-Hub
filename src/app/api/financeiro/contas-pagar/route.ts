import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().positive(),
  dueDate: z.string(),
  category: z.string().min(1),
  supplier: z.string().optional(),
  recurring: z.boolean().default(false),
  bankAccountId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const bills = await db.bill.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(from || to ? { dueDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {}),
    },
    include: { bankAccount: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  })

  // Auto-mark overdue
  const today = new Date()
  const serialized = bills.map((b) => ({
    ...b,
    amount: Number(b.amount),
    status: b.status === "PENDING" && new Date(b.dueDate) < today ? "OVERDUE" : b.status,
    dueDate: b.dueDate.toISOString(),
    paidAt: b.paidAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }))

  return NextResponse.json(serialized)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { bankAccountId, ...data } = parsed.data
  const bill = await db.bill.create({
    data: { ...data, dueDate: new Date(data.dueDate), bankAccountId: bankAccountId || null },
    include: { bankAccount: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ ...bill, amount: Number(bill.amount), dueDate: bill.dueDate.toISOString(), paidAt: null, createdAt: bill.createdAt.toISOString(), updatedAt: bill.updatedAt.toISOString() }, { status: 201 })
}
