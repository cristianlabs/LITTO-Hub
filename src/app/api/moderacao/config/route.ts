import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { hasMinRole } from "@/lib/permissions"
import type { Role } from "@prisma/client"
import { DEFAULT_PALAVRAS } from "@/lib/moderacao"

const CONFIG_KEY = "moderacao_palavras"
const CONFIG_ENABLED_KEY = "moderacao_enabled"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [wordsRecord, enabledRecord] = await Promise.all([
    db.systemConfig.findUnique({ where: { key: CONFIG_KEY } }),
    db.systemConfig.findUnique({ where: { key: CONFIG_ENABLED_KEY } }),
  ])

  const customWords: string[] = wordsRecord ? JSON.parse(wordsRecord.value) : []
  const enabled: boolean = enabledRecord ? JSON.parse(enabledRecord.value) : true

  return NextResponse.json({ customWords, defaultWords: DEFAULT_PALAVRAS, enabled })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role as Role, "MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const customWords: string[] = Array.isArray(body.customWords) ? body.customWords : []
  const enabled: boolean = typeof body.enabled === "boolean" ? body.enabled : true

  await Promise.all([
    db.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: JSON.stringify(customWords) },
      update: { value: JSON.stringify(customWords) },
    }),
    db.systemConfig.upsert({
      where: { key: CONFIG_ENABLED_KEY },
      create: { key: CONFIG_ENABLED_KEY, value: JSON.stringify(enabled) },
      update: { value: JSON.stringify(enabled) },
    }),
  ])

  return NextResponse.json({ ok: true, customWords, enabled })
}
