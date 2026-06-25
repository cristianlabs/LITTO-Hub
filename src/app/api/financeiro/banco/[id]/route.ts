import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).optional(),
  bank: z.string().optional(),
  agency: z.string().optional(),
  account: z.string().optional(),
  type: z.enum(["CHECKING", "SAVINGS", "INVESTMENT", "CASH"]).optional(),
  balance: z.coerce.number().optional(),
  active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const account = await db.bankAccount.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ ...account, balance: Number(account.balance) })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.bankAccount.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
