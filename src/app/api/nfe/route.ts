import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  number: z.string().min(1),
  series: z.string().default("1"),
  type: z.enum(["ENTRADA", "SAIDA"]),
  accessKey: z.string().optional(),
  emitter: z.string().min(1),
  recipient: z.string().optional(),
  totalValue: z.coerce.number().min(0),
  emittedAt: z.string(),
  notes: z.string().optional(),
  purchaseOrderId: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notes = await db.fiscalNote.findMany({
    orderBy: { emittedAt: "desc" },
    include: {
      canhoto: true,
      purchaseOrder: { select: { id: true, number: true, title: true } },
    },
  })

  return NextResponse.json(notes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data

  const note = await db.fiscalNote.create({
    data: {
      number: data.number,
      series: data.series,
      type: data.type,
      accessKey: data.accessKey || null,
      emitter: data.emitter,
      recipient: data.recipient || null,
      totalValue: data.totalValue,
      emittedAt: new Date(data.emittedAt),
      notes: data.notes || null,
      purchaseOrderId: data.purchaseOrderId || null,
    },
    include: {
      canhoto: true,
      purchaseOrder: { select: { id: true, number: true, title: true } },
    },
  })

  return NextResponse.json(note, { status: 201 })
}
