import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { detectarPalavrasOfensivas, verificarEFlagarMensagem } from "@/lib/moderacao"
import { db } from "@/lib/db"
import { hasMinRole } from "@/lib/permissions"
import type { Role } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role as Role, "MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const texto = req.nextUrl.searchParams.get("texto") ?? ""

  let customWords: string[] = []
  const configRecord = await db.systemConfig.findUnique({ where: { key: "moderacao_palavras" } })
  if (configRecord) {
    try { customWords = JSON.parse(configRecord.value) } catch {}
  }

  const enabledRecord = await db.systemConfig.findUnique({ where: { key: "moderacao_enabled" } })
  const enabled = enabledRecord ? JSON.parse(enabledRecord.value) !== false : true
  const triggered = detectarPalavrasOfensivas(texto, customWords)
  const totalFlagged = await db.flaggedMessage.count()
  const recentFlagged = await db.flaggedMessage.findMany({
    orderBy: { createdAt: "desc" }, take: 5,
    select: { id: true, body: true, triggeredWords: true, createdAt: true },
  })

  return NextResponse.json({ texto, enabled, customWords, triggered, match: triggered.length > 0, totalFlaggedNoSistema: totalFlagged, recentFlagged })
}

// POST /api/moderacao/teste
// Simula o envio de uma mensagem ofensiva e roda a moderação completa
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role as Role, "MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Usa a conversa e mensagem mais recente como base
  const lastMsg = await db.message.findFirst({
    orderBy: { createdAt: "desc" },
    include: { conversation: { include: { instance: true } } },
  })
  if (!lastMsg) return NextResponse.json({ error: "Nenhuma mensagem no banco" }, { status: 400 })

  // Cria uma mensagem de teste
  let testMsg
  try {
    testMsg = await db.message.create({
      data: {
        conversationId: lastMsg.conversationId,
        direction: "OUTBOUND",
        body: "idiota teste de moderacao",
        type: "text",
        status: "SENT",
        sentBy: session.user.id,
      },
    })
  } catch (err) {
    return NextResponse.json({ step: "criar_mensagem", error: String(err) }, { status: 500 })
  }

  // Roda a moderação — expõe o erro diretamente
  try {
    await verificarEFlagarMensagem({
      messageId: testMsg.id,
      conversationId: lastMsg.conversationId,
      body: testMsg.body,
      direction: "OUTBOUND",
      sentByUserId: session.user.id,
      remoteJid: lastMsg.conversation.remoteJid,
      instanceName: lastMsg.conversation.instance.name,
    })
    const flagged = await db.flaggedMessage.findUnique({ where: { messageId: testMsg.id } })
    return NextResponse.json({ ok: true, testMessageId: testMsg.id, flagged })
  } catch (err) {
    return NextResponse.json({ step: "verificar_e_flagar", error: String(err), errorDetail: err instanceof Error ? err.stack : undefined }, { status: 500 })
  }
}
