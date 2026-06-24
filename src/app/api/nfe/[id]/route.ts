import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const updateSchema = z.object({
  status: z.enum(["PENDING", "RECEIVED", "CANCELLED"]).optional(),
  notes: z.string().optional(),
})

const canhotoSchema = z.object({
  receivedBy: z.string().min(1),
  receivedAt: z.string(),
  observations: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // If body has receivedBy it's a canhoto registration
  if (body.receivedBy !== undefined) {
    const parsed = canhotoSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { receivedBy, receivedAt, observations } = parsed.data

    await db.canhoto.upsert({
      where: { fiscalNoteId: id },
      create: { fiscalNoteId: id, receivedBy, receivedAt: new Date(receivedAt), observations: observations || null },
      update: { receivedBy, receivedAt: new Date(receivedAt), observations: observations || null },
    })

    const updated = await db.fiscalNote.update({
      where: { id },
      data: { status: "RECEIVED" },
      include: {
        canhoto: true,
        purchaseOrder: { select: { id: true, number: true, title: true } },
      },
    })

    return NextResponse.json(updated)
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await db.fiscalNote.update({
    where: { id },
    data: parsed.data,
    include: {
      canhoto: true,
      purchaseOrder: { select: { id: true, number: true, title: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.fiscalNote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
