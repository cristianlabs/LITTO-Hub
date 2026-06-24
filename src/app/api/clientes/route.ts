import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  creditLimit: z.number().min(0).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""

  const clients = await db.contact.findMany({
    where: {
      status: "ACTIVE",
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { razaoSocial: { contains: q, mode: "insensitive" } },
          { cnpj: { contains: q } },
          { cpf: { contains: q } },
        ],
      } : {}),
    },
    include: {
      company: true,
      deals: { select: { value: true, status: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(clients)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, ...data } = await req.json()
  const parsed = schema.safeParse(data)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const contact = await db.contact.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(contact)
}
