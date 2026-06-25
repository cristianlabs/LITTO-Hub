"use client"

import { useState } from "react"
import { X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Instance {
  id: string
  name: string
  connected: boolean
}

interface Props {
  instances: Instance[]
  onClose: () => void
  onSuccess: (conversationId: string) => void
}

export function NovaConversaModal({ instances, onClose, onSuccess }: Props) {
  const connected = instances.filter((i) => i.connected)
  const [instanceId, setInstanceId] = useState(connected[0]?.id ?? "")
  const [phone, setPhone] = useState("55")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  async function handleSend() {
    if (!instanceId || !phone.trim() || !message.trim()) return
    setSending(true)
    setError("")

    try {
      const res = await fetch("/api/comunicacao/conversas/nova", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, phone: phone.trim(), message: message.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar mensagem")
        return
      }

      onSuccess(data.conversationId)
    } catch {
      setError("Erro de conexão")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nova conversa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {connected.length === 0 ? (
            <p className="text-sm text-red-500">Nenhuma instância conectada. Conecte um WhatsApp primeiro.</p>
          ) : (
            <>
              {connected.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Instância</label>
                  <select
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {connected.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número (com DDD e código do país)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="5511999998888"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Ex: 5511999998888 (55 = Brasil, 11 = SP)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          {connected.length > 0 && (
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !phone.trim() || !message.trim()}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
