import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  order: z.number().int().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pipelines = await db.pipeline.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { deals: true } } },
  })
  return NextResponse.json(pipelines)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const count = await db.pipeline.count()
  const pipeline = await db.pipeline.create({
    data: { ...parsed.data, order: parsed.data.order ?? count },
  })
  return NextResponse.json(pipeline, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, ...data } = await req.json()
  const pipeline = await db.pipeline.update({ where: { id }, data })
  return NextResponse.json(pipeline)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const dealsCount = await db.deal.count({ where: { pipelineId: id } })
  if (dealsCount > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: ${dealsCount} negócio(s) neste pipeline.` },
      { status: 422 },
    )
  }

  await db.pipeline.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
