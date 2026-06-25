import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
  token: z.string().length(6),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ valid: false, error: "Dados inválidos" }, { status: 400 })

  const { email, token } = parsed.data

  const record = await db.twoFactorToken.findFirst({
    where: { email, token, used: false },
    orderBy: { createdAt: "desc" },
  })

  if (!record) return NextResponse.json({ valid: false, error: "Código inválido" }, { status: 400 })
  if (record.expiresAt < new Date()) {
    await db.twoFactorToken.delete({ where: { id: record.id } })
    return NextResponse.json({ valid: false, error: "Código expirado" }, { status: 400 })
  }

  await db.twoFactorToken.update({ where: { id: record.id }, data: { used: true } })

  return NextResponse.json({ valid: true })
}
