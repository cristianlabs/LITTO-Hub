import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  title: z.string().min(1),
  value: z.number().optional(),
  pipelineId: z.string(),
  contactId: z.string().optional(),
  expectedClose: z.string().optional(),
  status: z.enum(["OPEN", "WON", "LOST", "FROZEN"]).optional(),
})

const moveSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const deals = await db.deal.findMany({
    include: { contact: true, pipeline: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(deals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Move deal between pipelines
  if ("id" in body && "pipelineId" in body && Object.keys(body).length === 2) {
    const parsed = moveSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const deal = await db.deal.update({
      where: { id: parsed.data.id },
      data: { pipelineId: parsed.data.pipelineId },
    })
    return NextResponse.json(deal)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const deal = await db.deal.create({
    data: {
      title: parsed.data.title,
      value: parsed.data.value,
      pipelineId: parsed.data.pipelineId,
      contactId: parsed.data.contactId ?? null,
      expectedClose: parsed.data.expectedClose ? new Date(parsed.data.expectedClose) : null,
    },
    include: { contact: true, pipeline: true },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", resource: "Deal", resourceId: deal.id },
  })

  return NextResponse.json(deal, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body

  const deal = await db.deal.update({
    where: { id },
    data: {
      ...data,
      expectedClose: data.expectedClose ? new Date(data.expectedClose) : undefined,
    },
    include: { contact: true, pipeline: true },
  })

  return NextResponse.json(deal)
}
