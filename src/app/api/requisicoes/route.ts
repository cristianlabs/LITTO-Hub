import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.enum(["PURCHASE", "SYSTEM_IMPROVEMENT", "INFRASTRUCTURE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const requisitions = await db.requisition.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  })

  return NextResponse.json(
    requisitions.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const requisition = await db.requisition.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
      status: "OPEN",
    },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  })

  return NextResponse.json({
    ...requisition,
    createdAt: requisition.createdAt.toISOString(),
    updatedAt: requisition.updatedAt.toISOString(),
  }, { status: 201 })
}
