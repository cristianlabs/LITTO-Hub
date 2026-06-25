import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasMinRole } from "@/lib/permissions"
import type { Role } from "@prisma/client"

const CONFIG_KEY = "relatorio_whatsapp"

const schema = z.object({
  enabled: z.boolean(),
  managerPhones: z.array(z.string()),
  instanceName: z.string(),
  sendTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  includedDays: z.array(z.number().int().min(0).max(6)),
  reportPeriod: z.enum(["yesterday", "today"]),
})

export type RelatorioWhatsappConfig = z.infer<typeof schema>

export const DEFAULT_CONFIG: RelatorioWhatsappConfig = {
  enabled: false,
  managerPhones: [],
  instanceName: "",
  sendTime: "18:00",
  includedDays: [1, 2, 3, 4, 5],
  reportPeriod: "today",
}

function migrateConfig(raw: Record<string, unknown>): RelatorioWhatsappConfig {
  // Migrate old single-phone configs
  if ("managerPhone" in raw && !("managerPhones" in raw)) {
    const phones = raw.managerPhone ? [raw.managerPhone as string] : []
    return { ...DEFAULT_CONFIG, ...raw, managerPhones: phones } as RelatorioWhatsappConfig
  }
  return { ...DEFAULT_CONFIG, ...raw } as RelatorioWhatsappConfig
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const headerSecret = req.headers.get("x-cron-secret")
  const isCron = cronSecret && headerSecret === cronSecret

  if (!isCron) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const record = await db.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
  if (!record) return NextResponse.json(DEFAULT_CONFIG)

  try {
    const parsed = JSON.parse(record.value)
    return NextResponse.json(migrateConfig(parsed))
  } catch {
    return NextResponse.json(DEFAULT_CONFIG)
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role as Role, "MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await db.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: JSON.stringify(parsed.data) },
    update: { value: JSON.stringify(parsed.data) },
  })

  return NextResponse.json(parsed.data)
}
