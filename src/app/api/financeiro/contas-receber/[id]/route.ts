import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  title: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  dueDate: z.string().optional(),
  category: z.string().optional(),
  client: z.string().optional(),
  status: z.enum(["PENDING", "RECEIVED", "OVERDUE", "CANCELLED"]).optional(),
  receivedAt: z.string().nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dueDate, receivedAt, ...rest } = parsed.data
  const item = await db.receivable.update({
    where: { id },
    data: {
      ...rest,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      ...(receivedAt !== undefined ? { receivedAt: receivedAt ? new Date(receivedAt) : null } : {}),
    },
    include: { contact: { select: { id: true, name: true } }, bankAccount: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ ...item, amount: Number(item.amount), dueDate: item.dueDate.toISOString(), receivedAt: item.receivedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.receivable.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
