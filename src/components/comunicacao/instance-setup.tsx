"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { QrCode, Wifi, WifiOff, Trash2, RefreshCw, Plus, Webhook } from "lucide-react"

interface Instance {
  id: string
  name: string
  phone?: string | null
  connected: boolean
  qrCode?: string | null
}

interface Props {
  instances: Instance[]
  onRefresh: () => void
}

const schema = z.object({ name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, "Apenas letras, números, _ e -") })
type FormData = z.infer<typeof schema>

export function InstanceSetup({ instances, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [qrDialog, setQrDialog] = useState<{ open: boolean; qr?: string; name?: string }>({ open: false })
  const [loading, setLoading] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onCreate(data: FormData) {
    const res = await fetch("/api/comunicacao/instancias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      reset()
      setShowCreate(false)
      onRefresh()
    }
  }

  async function handleQR(instance: Instance) {
    setLoading(instance.id)
    try {
      const res = await fetch("/api/comunicacao/instancias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: instance.id, action: "qr" }),
      })
      const data = await res.json()
      if (data.qrCode) {
        setQrDialog({ open: true, qr: data.qrCode, name: instance.name })
        onRefresh()
      } else {
        alert(data.error ?? "Não foi possível obter o QR Code")
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleStatus(id: string) {
    setLoading(id)
    try {
      await fetch("/api/comunicacao/instancias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "status" }),
      })
      onRefresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleWebhook(id: string) {
    setLoading(id + "-webhook")
    try {
      const res = await fetch("/api/comunicacao/instancias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "webhook" }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(`Webhook registrado com sucesso!\n${data.webhookUrl}`)
      } else {
        alert(data.error ?? "Erro ao registrar webhook")
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir instância "${name}"?`)) return
    setLoading(id)
    try {
      await fetch(`/api/comunicacao/instancias?id=${id}`, { method: "DELETE" })
      onRefresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Instâncias WhatsApp</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cada instância corresponde a um número de WhatsApp conectado via Evolution API.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova instância
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleSubmit(onCreate)} className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Nome da instância</Label>
            <Input {...register("name")} placeholder="ex: atendimento-principal" />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {instances.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 text-center">
          <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma instância configurada</p>
          <p className="text-xs text-gray-400 mt-1">Crie uma instância e escaneie o QR Code para conectar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((inst) => (
            <div key={inst.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${inst.connected ? "bg-green-100" : "bg-gray-100"}`}>
                  {inst.connected
                    ? <Wifi className="w-4 h-4 text-green-600" />
                    : <WifiOff className="w-4 h-4 text-gray-400" />
                  }
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{inst.name}</p>
                  <p className={`text-xs ${inst.connected ? "text-green-600" : "text-gray-400"}`}>
                    {inst.connected ? "Conectado" : "Desconectado"}
                    {inst.phone && ` · ${inst.phone}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  title="Verificar status"
                  disabled={!!loading}
                  onClick={() => handleStatus(inst.id)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${loading === inst.id ? "animate-spin" : ""}`} />
                </button>
                <button
                  title="Registrar webhook (use se mensagens recebidas não aparecem)"
                  disabled={!!loading}
                  onClick={() => handleWebhook(inst.id)}
                  className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Webhook className={`w-4 h-4 ${loading === inst.id + "-webhook" ? "animate-pulse" : ""}`} />
                </button>
                {!inst.connected && (
                  <button
                    title="Ver QR Code"
                    disabled={loading === inst.id}
                    onClick={() => handleQR(inst)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                )}
                <button
                  title="Excluir instância"
                  disabled={loading === inst.id}
                  onClick={() => handleDelete(inst.id, inst.name)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(open) => setQrDialog({ open })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar {qrDialog.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDialog.qr ? (
              <>
                <img
                  src={qrDialog.qr.startsWith("data:") ? qrDialog.qr : `data:image/png;base64,${qrDialog.qr}`}
                  alt="QR Code"
                  className="w-56 h-56 rounded-xl border border-gray-200"
                />
                <p className="text-sm text-gray-500 text-center">
                  Abra o WhatsApp no celular, vá em <strong>Aparelhos conectados</strong> e escaneie este QR Code.
                </p>
              </>
            ) : (
              <p className="text-gray-400 text-sm">QR Code não disponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
