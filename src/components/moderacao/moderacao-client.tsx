"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Shield, ShieldAlert, ShieldCheck, Trash2, Plus, X, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { normalizeJid } from "@/lib/evolution"

interface FlaggedItem {
  id: string
  body: string
  triggeredWords: string[]
  direction: "INBOUND" | "OUTBOUND"
  remoteJid: string
  instanceName: string
  notifiedAt: string | null
  createdAt: string
  sentBy: { id: string; name: string | null; email: string } | null
  conversation: { remoteJid: string; contact: { name: string | null } | null }
}

interface Props {
  initialItems: FlaggedItem[]
  initialTotal: number
  initialPages: number
  customWords: string[]
  defaultWords: string[]
  enabled: boolean
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

export function ModeracaoClient({ initialItems, initialTotal, initialPages, customWords: initialCustomWords, defaultWords, enabled: initialEnabled }: Props) {
  const [tab, setTab] = useState<"flags" | "config">("flags")
  const [items, setItems] = useState(initialItems)
  const [total, setTotal] = useState(initialTotal)
  const [pages, setPages] = useState(initialPages)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Config state
  const [enabled, setEnabled] = useState(initialEnabled)
  const [customWords, setCustomWords] = useState<string[]>(initialCustomWords)
  const [newWord, setNewWord] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function loadPage(p: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/moderacao/flagged?page=${p}`)
      const data = await res.json()
      setItems(data.items)
      setTotal(data.total)
      setPages(data.pages)
      setPage(p)
    } finally { setLoading(false) }
  }

  async function deleteFlag(id: string) {
    if (!confirm("Remover este registro?")) return
    await fetch(`/api/moderacao/flagged?id=${id}`, { method: "DELETE" })
    setItems((prev) => prev.filter((i) => i.id !== id))
    setTotal((t) => t - 1)
  }

  function addWord() {
    const w = newWord.trim().toLowerCase()
    if (!w || customWords.includes(w)) return
    setCustomWords((prev) => [...prev, w])
    setNewWord("")
  }

  async function saveConfig() {
    setSaving(true)
    try {
      await fetch("/api/moderacao/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customWords, enabled }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Moderação de Mensagens</h2>
          <p className="text-sm text-gray-500">Detecção de conteúdo ofensivo e alertas automáticos para o gestor</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {enabled ? "Ativo" : "Inativo"}
          </span>
          {total > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">
              {total} ocorrência{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {[
          { key: "flags", label: "Ocorrências", icon: ShieldAlert },
          { key: "config", label: "Configuração", icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as "flags" | "config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "flags" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{total} mensagem{total !== 1 ? "s" : ""} flagrada{total !== 1 ? "s" : ""}</p>
            <Button variant="outline" size="sm" onClick={() => loadPage(page)} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma ocorrência registrada</p>
              <p className="text-sm">As mensagens ofensivas detectadas aparecerão aqui</p>
            </div>
          )}

          {items.map((item) => {
            const contactName = item.conversation?.contact?.name
            const phone = normalizeJid(item.remoteJid)
            const displayName = contactName ?? phone

            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.direction === "OUTBOUND" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                      {item.direction === "OUTBOUND" ? "↗ Enviada" : "↙ Recebida"}
                    </span>
                    <span className="text-xs text-gray-500">{timeAgo(item.createdAt)}</span>
                    {item.notifiedAt && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Gestor notificado
                      </span>
                    )}
                  </div>
                  <button onClick={() => deleteFlag(item.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{item.direction === "OUTBOUND" ? "Enviada por" : "Atendente responsável"}</p>
                    <p className="font-medium text-gray-800">{item.sentBy?.name ?? item.sentBy?.email ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Contato</p>
                    <p className="font-medium text-gray-800">{displayName}</p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-800">"{item.body.slice(0, 250)}{item.body.length > 250 ? "..." : ""}"</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {item.triggeredWords.map((w) => (
                    <span key={w} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => loadPage(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-500">Página {page} de {pages}</span>
              <Button variant="outline" size="sm" onClick={() => loadPage(page + 1)} disabled={page >= pages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "config" && (
        <div className="max-w-2xl space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
            <div>
              <p className="font-medium text-gray-900 text-sm">Moderação ativa</p>
              <p className="text-xs text-gray-500 mt-0.5">Analisa todas as mensagens em tempo real</p>
            </div>
            <button
              onClick={() => setEnabled((p) => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-green-500" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {/* Default words (read-only) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div>
              <p className="font-medium text-gray-900 text-sm">Palavras padrão ({defaultWords.length})</p>
              <p className="text-xs text-gray-400 mt-0.5">Lista base incluída automaticamente. Não editável.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {defaultWords.map((w) => (
                <span key={w} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{w}</span>
              ))}
            </div>
          </div>

          {/* Custom words */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <p className="font-medium text-gray-900 text-sm">Palavras personalizadas</p>
              <p className="text-xs text-gray-400 mt-0.5">Adicione termos específicos do seu negócio ou contexto.</p>
            </div>

            <div className="flex gap-2">
              <Input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="nova palavra..."
                onKeyDown={(e) => e.key === "Enter" && addWord()}
              />
              <Button onClick={addWord} size="sm" variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {customWords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {customWords.map((w) => (
                  <span key={w} className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {w}
                    <button onClick={() => setCustomWords((prev) => prev.filter((x) => x !== w))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhuma palavra personalizada adicionada.</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-medium">Como funciona o alerta</p>
            <p>Quando uma mensagem ofensiva é detectada, o sistema envia automaticamente uma notificação no WhatsApp para o número configurado em <strong>Configurações → Relatório WhatsApp</strong>, informando quem enviou, o conteúdo e as palavras detectadas.</p>
          </div>

          <Button onClick={saveConfig} disabled={saving}>
            {saved ? <><ShieldCheck className="w-4 h-4 mr-1.5 text-green-500" />Salvo!</> : saving ? "Salvando..." : "Salvar configuração"}
          </Button>
        </div>
      )}
    </div>
  )
}
