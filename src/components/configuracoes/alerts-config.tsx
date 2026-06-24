"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Bell, Mail, Smartphone, MonitorSmartphone, Check } from "lucide-react"

interface AlertConfig { email: boolean; push: boolean; inApp: boolean }

export function AlertsConfig({ initialConfig }: { initialConfig: AlertConfig }) {
  const [config, setConfig] = useState(initialConfig)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch("/api/configuracoes/alertas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const options = [
    {
      key: "email" as const,
      label: "Alertas por e-mail",
      description: "Receba um email quando o estoque atingir o mínimo ou zerar",
      icon: Mail,
    },
    {
      key: "push" as const,
      label: "Notificações push",
      description: "Alertas instantâneos no navegador (requer permissão)",
      icon: Smartphone,
    },
    {
      key: "inApp" as const,
      label: "Notificações no sistema",
      description: "Alertas visíveis no sino de notificações dentro do sistema",
      icon: MonitorSmartphone,
    },
  ]

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
          <Bell className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Alertas de Estoque</h3>
          <p className="text-sm text-gray-500">Configure como você deseja receber alertas</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
        Alertas são disparados quando um produto atinge estoque zerado, mínimo ou máximo.
        Apenas usuários com role MANAGER ou superior recebem essas notificações.
      </div>

      <div className="space-y-3">
        {options.map(({ key, label, description, icon: Icon }) => (
          <div key={key} className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <Switch
              checked={config[key]}
              onCheckedChange={(v) => setConfig((prev) => ({ ...prev, [key]: v }))}
            />
          </div>
        ))}
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        {saved ? (
          <><Check className="w-4 h-4 mr-2" /> Salvo!</>
        ) : saving ? "Salvando..." : "Salvar preferências"}
      </Button>
    </div>
  )
}
