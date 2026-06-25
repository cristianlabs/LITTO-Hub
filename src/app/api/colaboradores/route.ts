import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { hasMinRole } from "@/lib/permissions"

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  role: z.enum(["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]),
  customRoleId: z.string().optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, role: true,
      active: true, createdAt: true,
      customRole: { select: { id: true, name: true, color: true, baseRole: true } },
      _count: { select: { activities: true, deals: true } },
    },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "HEAD_LEADER"))
    return NextResponse.json({ error: "Sem permissão para criar usuários" }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } })
  if (exists) return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 })

  // If customRoleId given, derive role from it
  let role = parsed.data.role
  if (parsed.data.customRoleId) {
    const cr = await db.customRole.findUnique({ where: { id: parsed.data.customRoleId } })
    if (cr) role = cr.baseRole
  }

  const hashed = await bcrypt.hash(parsed.data.password, 12)
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashed,
      role,
      customRoleId: parsed.data.customRoleId ?? null,
    },
    select: {
      id: true, name: true, email: true, role: true,
      active: true, createdAt: true,
      customRole: { select: { id: true, name: true, color: true, baseRole: true } },
    },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", resource: "User", resourceId: user.id },
  })

  return NextResponse.json(user, { status: 201 })
}
