import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  razaoSocial: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "LOST"]).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  companyId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const status = searchParams.get("status") ?? ""

  const contacts = await db.contact.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            }
          : {},
        status ? { status: status as "LEAD" | "PROSPECT" | "ACTIVE" | "INACTIVE" | "LOST" } : {},
      ],
    },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(contacts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const contact = await db.contact.create({
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
      tags: parsed.data.tags ?? [],
    },
  })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      resource: "Contact",
      resourceId: contact.id,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    },
  })

  return NextResponse.json(contact, { status: 201 })
}
