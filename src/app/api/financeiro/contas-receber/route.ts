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
  client: z.string().optional(),
  contactId: z.string().optional(),
  bankAccountId: z.string().optional(),
})

function serialize(r: Record<string, unknown>) {
  return {
    ...r,
    amount: Number(r.amount),
    dueDate: r.dueDate instanceof Date ? r.dueDate.toISOString() : r.dueDate,
    receivedAt: r.receivedAt instanceof Date ? (r.receivedAt as Date).toISOString() : (r.receivedAt ?? null),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const items = await db.receivable.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(from || to ? { dueDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {}),
    },
    include: {
      contact: { select: { id: true, name: true } },
      bankAccount: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  const today = new Date()
  return NextResponse.json(items.map((r) => serialize({
    ...r,
    status: r.status === "PENDING" && new Date(r.dueDate) < today ? "OVERDUE" : r.status,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { bankAccountId, contactId, ...data } = parsed.data
  const item = await db.receivable.create({
    data: { ...data, dueDate: new Date(data.dueDate), bankAccountId: bankAccountId || null, contactId: contactId || null },
    include: { contact: { select: { id: true, name: true } }, bankAccount: { select: { id: true, name: true } } },
  })

  return NextResponse.json(serialize(item as never), { status: 201 })
}
