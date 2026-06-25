import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  bank: z.string().optional(),
  agency: z.string().optional(),
  account: z.string().optional(),
  type: z.enum(["CHECKING", "SAVINGS", "INVESTMENT", "CASH"]).default("CHECKING"),
  balance: z.coerce.number().default(0),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accounts = await db.bankAccount.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(accounts.map((a) => ({ ...a, balance: Number(a.balance) })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const account = await db.bankAccount.create({ data: parsed.data })
  return NextResponse.json({ ...account, balance: Number(account.balance) }, { status: 201 })
}
