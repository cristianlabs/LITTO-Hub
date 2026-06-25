import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { gerarEEnviarRelatorio } from "@/lib/relatorio-diario"
import type { RelatorioWhatsappConfig } from "@/app/api/configuracoes/relatorio-whatsapp/route"
import { DEFAULT_CONFIG } from "@/app/api/configuracoes/relatorio-whatsapp/route"

// Called by cron or manually with ?secret=CRON_SECRET
// Also accepts ?manual=1 from the UI (requires session header set by the config page)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  const isManual = searchParams.get("manual") === "1"

  if (!isManual) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const record = await db.systemConfig.findUnique({ where: { key: "relatorio_whatsapp" } })
  const config: RelatorioWhatsappConfig = record ? JSON.parse(record.value) : DEFAULT_CONFIG

  if (!config.enabled && !isManual) {
    return NextResponse.json({ skipped: true, reason: "Relatório desativado" })
  }

  if (!isManual) {
    // Check if today is an included day (0=Sun … 6=Sat)
    const today = new Date().getDay()
    if (!config.includedDays.includes(today)) {
      return NextResponse.json({ skipped: true, reason: "Dia não incluso na programação" })
    }
  }

  try {
    const result = await gerarEEnviarRelatorio(config, isManual ? undefined : undefined)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[cron/relatorio-diario]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
