import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["OPEN", "WON", "LOST"]).optional(),
  value: z.number().optional(),
  sellerId: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? ""
  const sellerId = searchParams.get("sellerId") ?? ""
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const q = searchParams.get("q") ?? ""

  const deals = await db.deal.findMany({
    where: {
      ...(status ? { status: status as "OPEN" | "WON" | "LOST" } : {}),
      ...(sellerId ? { sellerId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
        },
      } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: {
      contact: { select: { id: true, name: true } },
      pipeline: { select: { id: true, name: true, color: true } },
      seller: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(deals)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, status, value, sellerId, closedAt } = parsed.data

  const data: Record<string, unknown> = {}
  if (status !== undefined) {
    data.status = status
    if (status === "WON" || status === "LOST") data.closedAt = new Date()
    if (status === "OPEN") data.closedAt = null
  }
  if (value !== undefined) data.value = value
  if (sellerId !== undefined) data.sellerId = sellerId
  if (closedAt !== undefined) data.closedAt = closedAt ? new Date(closedAt) : null

  const deal = await db.deal.update({
    where: { id },
    data,
    include: {
      contact: { select: { id: true, name: true } },
      pipeline: { select: { id: true, name: true, color: true } },
      seller: { select: { id: true, name: true } },
    },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", resource: "Deal", resourceId: id },
  })

  return NextResponse.json({ ...deal, value: deal.value ? Number(deal.value) : null })
}
