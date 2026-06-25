/**
 * Scheduler local — rode em paralelo com o Next.js:
 *   node scripts/cron.mjs
 *
 * Verifica a cada minuto se é hora de enviar o relatório diário.
 * Usa as mesmas variáveis do .env (DATABASE_URL e CRON_SECRET).
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

// Carrega .env manualmente
function loadEnv() {
  try {
    const env = readFileSync(resolve(root, ".env"), "utf-8")
    for (const line of env.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const idx = trimmed.indexOf("=")
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    console.warn("[cron] Aviso: não foi possível ler .env")
  }
}

loadEnv()

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
const CRON_SECRET = process.env.CRON_SECRET ?? ""

if (!CRON_SECRET) {
  console.error("[cron] CRON_SECRET não definido no .env — abortando")
  process.exit(1)
}

let lastFiredDate = "" // evita disparar mais de uma vez no mesmo dia+hora

async function tick() {
  const now = new Date()
  const hhmm = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false })
  const dateKey = `${now.toDateString()}-${hhmm}`

  if (lastFiredDate === dateKey) return // já disparou nesse minuto

  try {
    // Consulta a config atual do banco via API
    const configRes = await fetch(`${BASE_URL}/api/configuracoes/relatorio-whatsapp`, {
      headers: { "x-cron-secret": CRON_SECRET },
    })
    if (!configRes.ok) return

    const config = await configRes.json()
    if (!config.enabled) return
    if (config.sendTime !== hhmm) return

    // É a hora certa — dispara
    console.log(`[cron] ${new Date().toISOString()} — Disparando relatório diário (${hhmm})`)
    lastFiredDate = dateKey

    const res = await fetch(`${BASE_URL}/api/cron/relatorio-diario?secret=${CRON_SECRET}`, {
      method: "POST",
    })
    const data = await res.json()
    console.log("[cron] Resultado:", JSON.stringify(data))
  } catch (err) {
    console.error("[cron] Erro:", err)
  }
}

// Roda imediatamente e depois a cada minuto
tick()
setInterval(tick, 60_000)

console.log(`[cron] Scheduler iniciado — verificando a cada minuto (base: ${BASE_URL})`)
