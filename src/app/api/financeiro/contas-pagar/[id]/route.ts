import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  dueDate: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  paidAt: z.string().nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dueDate, paidAt, ...rest } = parsed.data

  const bill = await db.bill.update({
    where: { id },
    data: {
      ...rest,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
    },
    include: { bankAccount: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ ...bill, amount: Number(bill.amount), dueDate: bill.dueDate.toISOString(), paidAt: bill.paidAt?.toISOString() ?? null, createdAt: bill.createdAt.toISOString(), updatedAt: bill.updatedAt.toISOString() })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.bill.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
