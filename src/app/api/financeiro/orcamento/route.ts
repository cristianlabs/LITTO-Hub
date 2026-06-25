import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  category: z.string().min(1),
  planned: z.coerce.number().min(0),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get("year") ?? new Date().getFullYear())
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : null

  const budgets = await db.budget.findMany({
    where: { year, ...(month ? { month } : {}) },
    orderBy: [{ month: "asc" }, { category: "asc" }],
  })

  return NextResponse.json(budgets.map((b) => ({ ...b, planned: Number(b.planned) })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const budget = await db.budget.upsert({
    where: { year_month_category: { year: parsed.data.year, month: parsed.data.month, category: parsed.data.category } },
    create: parsed.data,
    update: { planned: parsed.data.planned },
  })

  return NextResponse.json({ ...budget, planned: Number(budget.planned) })
}
