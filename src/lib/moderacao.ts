import { db } from "@/lib/db"
import { sendTextMessage } from "@/lib/evolution"
import { normalizeJid } from "@/lib/evolution"
import type { RelatorioWhatsappConfig } from "@/app/api/configuracoes/relatorio-whatsapp/route"

// Words stored without accents so matching doesn't depend on NFD normalization
export const DEFAULT_PALAVRAS: string[] = [
  "idiota", "imbecil", "burro", "incompetente", "lixo", "inutil",
  "otario", "otaria", "fdp", "viado", "viadinho", "puta", "puto",
  "merda", "bosta", "caralho", "porra", "foda", "fodase",
  "arrombado", "arrombada", "corno", "cornudo", "vagabundo", "vagabunda",
  "desgraca", "maldito", "maldita", "sua mae", "vai se fuder",
  "vai tomar no", "cala boca", "babaca", "cretino", "cretina",
  "estupido", "estupida", "ridiculo", "ridicula", "palhaco", "palhaca",
  "ladrao", "ladrona", "golpista", "chantagista", "mentiroso", "mentirosa",
]

function simplifyText(s: string): string {
  return s
    .toLowerCase()
    // Replace accented chars with base equivalents
    .replace(/[áàãâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòõôö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[ñ]/g, "n")
    // Replace non-alphanumeric (except spaces) with space so "foda-se" → "foda se"
    .replace(/[^a-z0-9 ]/g, " ")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim()
}

export function detectarPalavrasOfensivas(texto: string, customWords: string[]): string[] {
  const normalized = simplifyText(texto)
  // Pad with spaces so boundary checks work for first/last word
  const padded = ` ${normalized} `

  const allWords = [
    ...DEFAULT_PALAVRAS.map((w) => ({ original: w, simplified: simplifyText(w) })),
    ...customWords.map((w) => ({ original: w, simplified: simplifyText(w) })),
  ]

  return allWords
    .filter(({ simplified }) => {
      if (!simplified) return false
      // Check for whole-word match using space padding
      return padded.includes(` ${simplified} `)
    })
    .map(({ original }) => original)
}

export async function verificarEFlagarMensagem({
  messageId,
  conversationId,
  body,
  direction,
  sentByUserId,
  remoteJid,
  instanceName,
}: {
  messageId: string
  conversationId: string
  body: string
  direction: "INBOUND" | "OUTBOUND"
  sentByUserId?: string | null
  remoteJid: string
  instanceName: string
}) {
  try {
    // Skip media placeholders
    if (/^\[.+\]$/.test(body.trim())) return

    // Check if moderation is enabled (default: enabled when no record exists)
    const enabledRecord = await db.systemConfig.findUnique({ where: { key: "moderacao_enabled" } })
    if (enabledRecord) {
      const isEnabled = JSON.parse(enabledRecord.value)
      if (isEnabled === false) {
        console.log("[moderacao] Desativada, pulando")
        return
      }
    }

    // Load custom words
    let customWords: string[] = []
    const configRecord = await db.systemConfig.findUnique({ where: { key: "moderacao_palavras" } })
    if (configRecord) {
      try { customWords = JSON.parse(configRecord.value) } catch {}
    }

    const triggered = detectarPalavrasOfensivas(body, customWords)
    console.log(`[moderacao] msg="${body.slice(0, 50)}" triggered=${JSON.stringify(triggered)}`)

    if (triggered.length === 0) return

    // Guard against duplicate
    const alreadyFlagged = await db.flaggedMessage.findUnique({ where: { messageId } })
    if (alreadyFlagged) return

    const flagged = await db.flaggedMessage.create({
      data: {
        messageId,
        conversationId,
        body,
        triggeredWords: triggered,
        direction,
        sentByUserId: sentByUserId ?? null,
        remoteJid,
        instanceName,
      },
    })

    console.log(`[moderacao] Flagged! id=${flagged.id} palavras=${triggered.join(", ")}`)

    await enviarAlertaGestor(flagged.id, { body, triggered, direction, sentByUserId: sentByUserId ?? null, remoteJid, instanceName })
  } catch (err) {
    console.error("[moderacao] Erro interno:", err)
    throw err
  }
}

async function enviarAlertaGestor(
  flaggedId: string,
  data: {
    body: string
    triggered: string[]
    direction: "INBOUND" | "OUTBOUND"
    sentByUserId: string | null
    remoteJid: string
    instanceName: string
  }
) {
  const relatorioRecord = await db.systemConfig.findUnique({ where: { key: "relatorio_whatsapp" } })
  if (!relatorioRecord) {
    console.log("[moderacao] Config do gestor não encontrada, alerta não enviado")
    return
  }

  let config: RelatorioWhatsappConfig
  try { config = JSON.parse(relatorioRecord.value) } catch { return }
  // Migrate old single-phone format
  const phones: string[] = (config as unknown as { managerPhone?: string }).managerPhone
    ? [(config as unknown as { managerPhone: string }).managerPhone]
    : config.managerPhones ?? []
  if (phones.length === 0 || !config.instanceName) {
    console.log("[moderacao] Nenhum número de destino ou instância configurados")
    return
  }

  let senderLabel: string
  if (data.direction === "OUTBOUND") {
    if (data.sentByUserId) {
      const user = await db.user.findUnique({ where: { id: data.sentByUserId }, select: { name: true, email: true } })
      senderLabel = user?.name ?? user?.email ?? "Colaborador desconhecido"
    } else {
      senderLabel = "Colaborador (via sistema)"
    }
  } else {
    senderLabel = `Cliente (${normalizeJid(data.remoteJid)})`
  }

  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const tipo = data.direction === "OUTBOUND" ? "enviada por colaborador" : "recebida de cliente"

  const alertText = [
    `Alerta de Mensagem Ofensiva`,
    ``,
    `Tipo: Mensagem ${tipo}`,
    `${data.direction === "OUTBOUND" ? "Enviada por" : "Responsavel"}: ${senderLabel}`,
    `Contato: ${normalizeJid(data.remoteJid)}`,
    `Horario: ${hora}`,
    `Instancia: ${data.instanceName}`,
    ``,
    `Mensagem:`,
    `"${data.body.slice(0, 300)}${data.body.length > 300 ? "..." : ""}"`,
    ``,
    `Palavras detectadas: ${data.triggered.join(", ")}`,
  ].join("\n")

  try {
    await Promise.all(phones.map((p) => sendTextMessage(config.instanceName, p, alertText)))
    await db.flaggedMessage.update({ where: { id: flaggedId }, data: { notifiedAt: new Date() } })
    console.log(`[moderacao] Alerta enviado para ${phones.join(", ")}`)
  } catch (err) {
    console.error("[moderacao] Erro ao enviar alerta:", err)
  }
}
