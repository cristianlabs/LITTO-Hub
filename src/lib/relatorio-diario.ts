import { db } from "@/lib/db"
import { sendTextMessage } from "@/lib/evolution"
import type { RelatorioWhatsappConfig } from "@/app/api/configuracoes/relatorio-whatsapp/route"

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
}

export async function gerarEEnviarRelatorio(config: RelatorioWhatsappConfig, forceDate?: Date) {
  const phones = config.managerPhones ?? []
  if (phones.length === 0 || !config.instanceName) {
    throw new Error("Nenhum número de destino ou instância configurados")
  }

  const now = forceDate ?? new Date()
  const period = config.reportPeriod

  let startDate: Date
  let endDate: Date
  let periodLabel: string

  if (period === "yesterday") {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 1)
    startDate.setHours(0, 0, 0, 0)
    endDate = new Date(startDate)
    endDate.setHours(23, 59, 59, 999)
    periodLabel = `Ontem, ${formatDate(startDate)}`
  } else {
    startDate = new Date(now)
    startDate.setHours(0, 0, 0, 0)
    endDate = new Date(now)
    periodLabel = `Hoje, ${formatDate(startDate)}`
  }

  // Buscar mensagens enviadas por colaboradores no período
  const messages = await db.message.findMany({
    where: {
      direction: "OUTBOUND",
      sentBy: { not: null },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { sentBy: true, conversationId: true },
  })

  // Mensagens recebidas (inbound) no período, por conversa
  const inboundMessages = await db.message.findMany({
    where: {
      direction: "INBOUND",
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { conversationId: true },
  })

  // Conversas resolvidas no período
  const resolvedConversations = await db.conversation.findMany({
    where: {
      status: "RESOLVED",
      updatedAt: { gte: startDate, lte: endDate },
    },
    select: { assignedTo: true, id: true },
  })

  // Conversas ativas com mensagens no período
  const activeConversationIds = new Set([
    ...messages.map((m) => m.conversationId),
    ...inboundMessages.map((m) => m.conversationId),
  ])

  const activeConversations = await db.conversation.findMany({
    where: { id: { in: [...activeConversationIds] } },
    select: { id: true, assignedTo: true },
  })

  // Usuários envolvidos
  const userIds = new Set<string>([
    ...messages.map((m) => m.sentBy!),
    ...resolvedConversations.map((c) => c.assignedTo).filter((x): x is string => x !== null),
    ...activeConversations.map((c) => c.assignedTo).filter((x): x is string => x !== null),
  ])

  if (userIds.size === 0) {
    // Sem atividade, ainda assim enviar relatório de zero
    const msg = buildMessage(periodLabel, [])
    await Promise.all(phones.map((p) => sendTextMessage(config.instanceName, p, msg)))
    return { sent: true, usersCount: 0 }
  }

  const users = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true },
  })

  const userMap = new Map(users.map((u) => [u.id, u.name ?? "Sem nome"]))

  // Agregar por usuário
  type UserStats = {
    name: string
    messagesSent: number
    conversationsActive: Set<string>
    conversationsResolved: number
    messagesReceived: number
  }

  const stats = new Map<string, UserStats>()

  for (const userId of userIds) {
    stats.set(userId, {
      name: userMap.get(userId) ?? "Desconhecido",
      messagesSent: 0,
      conversationsActive: new Set(),
      conversationsResolved: 0,
      messagesReceived: 0,
    })
  }

  for (const msg of messages) {
    if (!msg.sentBy) continue
    const s = stats.get(msg.sentBy)
    if (!s) continue
    s.messagesSent++
    s.conversationsActive.add(msg.conversationId)
  }

  for (const conv of activeConversations) {
    if (!conv.assignedTo) continue
    const s = stats.get(conv.assignedTo)
    if (!s) continue
    s.conversationsActive.add(conv.id)
    // Count inbound messages in this conversation
    const inboundCount = inboundMessages.filter((m) => m.conversationId === conv.id).length
    s.messagesReceived += inboundCount
  }

  for (const conv of resolvedConversations) {
    if (!conv.assignedTo) continue
    const s = stats.get(conv.assignedTo)
    if (!s) continue
    s.conversationsResolved++
  }

  const userStats = [...stats.entries()]
    .map(([, s]) => ({ ...s, conversationsActiveCount: s.conversationsActive.size }))
    .sort((a, b) => b.messagesSent - a.messagesSent)

  const msg = buildMessage(periodLabel, userStats)
  await Promise.all(phones.map((p) => sendTextMessage(config.instanceName, p, msg)))

  return { sent: true, usersCount: userStats.length }
}

function buildMessage(periodLabel: string, stats: { name: string; messagesSent: number; conversationsActiveCount: number; conversationsResolved: number; messagesReceived: number }[]) {
  const lines: string[] = []
  lines.push(`📊 *Relatório de Atendimentos*`)
  lines.push(`📅 ${periodLabel}`)
  lines.push("")

  if (stats.length === 0) {
    lines.push("_Nenhuma atividade registrada no período._")
    return lines.join("\n")
  }

  lines.push("*👥 Por colaborador:*")
  lines.push("")

  for (const s of stats) {
    lines.push(`👤 *${s.name}*`)
    lines.push(`   💬 Conversas: ${s.conversationsActiveCount}`)
    lines.push(`   ↗️ Enviadas: ${s.messagesSent} msg`)
    lines.push(`   ↙️ Recebidas: ${s.messagesReceived} msg`)
    if (s.conversationsResolved > 0) lines.push(`   ✅ Resolvidas: ${s.conversationsResolved}`)
    lines.push("")
  }

  const totals = stats.reduce((t, s) => ({
    convs: t.convs + s.conversationsActiveCount,
    sent: t.sent + s.messagesSent,
    received: t.received + s.messagesReceived,
    resolved: t.resolved + s.conversationsResolved,
  }), { convs: 0, sent: 0, received: 0, resolved: 0 })

  lines.push("─────────────────")
  lines.push(`📈 *Totais do dia:*`)
  lines.push(`   💬 ${totals.convs} conversas ativas`)
  lines.push(`   ↗️ ${totals.sent} mensagens enviadas`)
  lines.push(`   ↙️ ${totals.received} mensagens recebidas`)
  lines.push(`   ✅ ${totals.resolved} resolvidas`)

  return lines.join("\n")
}
