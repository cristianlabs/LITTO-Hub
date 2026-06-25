"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Send, CheckCircle2, MessageCircle, Info, Plus, Trash2, Users } from "lucide-react"
import type { RelatorioWhatsappConfig } from "@/app/api/configuracoes/relatorio-whatsapp/route"

interface Props {
  initialConfig: RelatorioWhatsappConfig
  instances: { id: string; name: string; connected: boolean }[]
}

const DAYS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
]

export function RelatorioWhatsappConfigComponent({ initialConfig, instances }: Props) {
  const [config, setConfig] = useState<RelatorioWhatsappConfig>(() => {
    // Migrate old single-phone format from DB
    const raw = initialConfig as RelatorioWhatsappConfig & { managerPhone?: string }
    if (raw.managerPhone !== undefined && !raw.managerPhones) {
      return { ...raw, managerPhones: raw.managerPhone ? [raw.managerPhone] : [] }
    }
    return { ...raw, managerPhones: raw.managerPhones ?? [] }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [newPhone, setNewPhone] = useState("")

  function toggleDay(day: number) {
    setConfig((prev) => ({
      ...prev,
      includedDays: prev.includedDays.includes(day)
        ? prev.includedDays.filter((d) => d !== day)
        : [...prev.includedDays, day].sort(),
    }))
  }

  function addPhone() {
    const clean = newPhone.replace(/\D/g, "")
    if (!clean) return
    if (config.managerPhones.includes(clean)) { setNewPhone(""); return }
    setConfig((p) => ({ ...p, managerPhones: [...p.managerPhones, clean] }))
    setNewPhone("")
  }

  function removePhone(phone: string) {
    setConfig((p) => ({ ...p, managerPhones: p.managerPhones.filter((n) => n !== phone) }))
  }

  function updatePhone(idx: number, val: string) {
    const clean = val.replace(/\D/g, "")
    setConfig((p) => {
      const phones = [...p.managerPhones]
      phones[idx] = clean
      return { ...p, managerPhones: phones }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/configuracoes/relatorio-whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
      else { const e = await res.json(); alert(e.error ?? "Erro ao salvar") }
    } finally { setSaving(false) }
  }

  async function sendNow() {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch("/api/cron/relatorio-diario?manual=1", { method: "POST" })
      const data = await res.json()
      if (res.ok) setSendResult(`✅ Relatório enviado para ${config.managerPhones.length} número(s) (${data.usersCount} colaboradores)`)
      else setSendResult(`❌ Erro: ${data.error}`)
    } finally { setSending(false) }
  }

  const cronUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/cron/relatorio-diario?secret=CRON_SECRET`
    : "/api/cron/relatorio-diario?secret=CRON_SECRET"

  const canSend = config.instanceName && config.managerPhones.length > 0

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">Relatório Diário via WhatsApp</p>
          <p className="text-sm text-gray-500">Envio automático do resumo de atendimentos para os gestores configurados. Também usado para alertas de moderação.</p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
        <div>
          <p className="font-medium text-gray-900 text-sm">Ativar envio automático</p>
          <p className="text-xs text-gray-500 mt-0.5">Envia o relatório automaticamente no horário configurado</p>
        </div>
        <button
          onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? "bg-green-500" : "bg-gray-200"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {/* Config fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">

        <div className="space-y-1.5">
          <Label>Instância do WhatsApp</Label>
          <select
            value={config.instanceName}
            onChange={(e) => setConfig((p) => ({ ...p, instanceName: e.target.value }))}
            className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Selecione uma instância —</option>
            {instances.map((i) => (
              <option key={i.id} value={i.name}>
                {i.name} {i.connected ? "✓" : "(desconectada)"}
              </option>
            ))}
          </select>
        </div>

        {/* Destinatários */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <Label>Destinatários do relatório e alertas de moderação</Label>
          </div>
          <p className="text-xs text-gray-400">
            Todos os números abaixo receberão o relatório diário <strong>e</strong> os alertas de mensagem ofensiva.
          </p>

          {config.managerPhones.length > 0 && (
            <div className="space-y-2">
              {config.managerPhones.map((phone, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400 font-mono">+</span>
                    <Input
                      value={phone}
                      onChange={(e) => updatePhone(idx, e.target.value)}
                      placeholder="5511999999999"
                      className="border-0 bg-transparent h-auto p-0 text-sm font-mono focus-visible:ring-0 shadow-none"
                    />
                  </div>
                  <button
                    onClick={() => removePhone(phone)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new phone */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 focus-within:border-blue-400 transition-colors">
              <span className="text-xs text-gray-400 font-mono">+</span>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && addPhone()}
                placeholder="5511999999999 — pressione Enter para adicionar"
                className="flex-1 bg-transparent text-sm font-mono outline-none text-gray-700 placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={addPhone}
              disabled={!newPhone}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400">Apenas números com DDI e DDD (ex: 5511999999999)</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Horário de envio</Label>
            <Input
              type="time"
              value={config.sendTime}
              onChange={(e) => setConfig((p) => ({ ...p, sendTime: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Período do relatório</Label>
            <select
              value={config.reportPeriod}
              onChange={(e) => setConfig((p) => ({ ...p, reportPeriod: e.target.value as "today" | "yesterday" }))}
              className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="today">Hoje (até o momento)</option>
              <option value="yesterday">Ontem (dia completo)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Dias de envio</Label>
          <div className="flex gap-2">
            {DAYS.map((d) => (
              <button
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                  config.includedDays.includes(d.value)
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-[#efeae2] border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preview da mensagem</p>
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 shadow-sm max-w-xs whitespace-pre-line font-mono text-xs leading-relaxed">
          {`📊 *Relatório de Atendimentos*
📅 Hoje, segunda-feira, 23/06/2025

*👥 Por colaborador:*

👤 *João Silva*
   💬 Conversas: 5
   ↗️ Enviadas: 23 msg
   ↙️ Recebidas: 18 msg
   ✅ Resolvidas: 3

─────────────────
📈 *Totais do dia:*
   💬 8 conversas ativas
   ↗️ 35 mensagens enviadas
   ↙️ 27 mensagens recebidas
   ✅ 3 resolvidas`}
        </div>
      </div>

      {/* Cron info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm font-medium text-blue-800">Como agendar o envio automático</p>
        </div>
        <p className="text-xs text-blue-700">
          Configure um serviço de cron para chamar o endpoint abaixo com método POST no horário desejado:
        </p>
        <code className="block bg-white border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-900 break-all">
          POST {cronUrl}
        </code>
        <p className="text-xs text-blue-600">
          Substitua <strong>CRON_SECRET</strong> pelo valor de <code>CRON_SECRET</code> no seu <code>.env</code>.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={save} disabled={saving}>
          {saved
            ? <><CheckCircle2 className="w-4 h-4 mr-1.5 text-green-500" /> Salvo!</>
            : <><Save className="w-4 h-4 mr-1.5" />{saving ? "Salvando..." : "Salvar configuração"}</>}
        </Button>
        <Button variant="outline" onClick={sendNow} disabled={sending || !canSend}>
          <Send className="w-4 h-4 mr-1.5" />{sending ? "Enviando..." : "Enviar agora (teste)"}
        </Button>
      </div>

      {sendResult && (
        <p className={`text-sm px-4 py-3 rounded-xl ${sendResult.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {sendResult}
        </p>
      )}
    </div>
  )
}
