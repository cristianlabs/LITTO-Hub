import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "LOST"]).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  companyId: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      company: true,
      deals: { include: { pipeline: true } },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(contact)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const contact = await db.contact.update({
    where: { id },
    data: { ...parsed.data, email: parsed.data.email || null },
    include: { company: true },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", resource: "Contact", resourceId: id },
  })

  return NextResponse.json(contact)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.contact.delete({ where: { id } })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", resource: "Contact", resourceId: id },
  })

  return NextResponse.json({ success: true })
}
