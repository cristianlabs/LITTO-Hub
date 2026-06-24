"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
  ShieldCheck, ShieldAlert, ShieldX, Shield,
  Building2, Calendar, DollarSign, Phone, Mail,
  MapPin, TrendingUp, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react"
import type { CnpjData } from "@/app/api/cnpj/route"

const RISK_CONFIG = {
  MUITO_BAIXO: { label: "Muito Baixo", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", Icon: ShieldCheck, bar: "bg-green-500" },
  BAIXO:       { label: "Baixo",       color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", Icon: ShieldCheck, bar: "bg-emerald-500" },
  MEDIO:       { label: "Médio",       color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", Icon: Shield, bar: "bg-yellow-500" },
  ALTO:        { label: "Alto",        color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", Icon: ShieldAlert, bar: "bg-orange-500" },
  MUITO_ALTO:  { label: "Muito Alto",  color: "text-red-700", bg: "bg-red-50", border: "border-red-200", Icon: ShieldX, bar: "bg-red-500" },
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cnpj: string
  onApply?: (data: { razaoSocial: string; creditLimit: number }) => void
}

export function CreditCheckDialog({ open, onOpenChange, cnpj, onApply }: Props) {
  const [data, setData] = useState<CnpjData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [consulted, setConsulted] = useState(false)

  async function consult() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/cnpj?cnpj=${encodeURIComponent(cnpj)}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Erro na consulta"); return }
      setData(json)
      setConsulted(true)
    } finally {
      setLoading(false)
    }
  }

  // Auto-consult when opening
  useState(() => { if (open && cnpj && !consulted) consult() })

  function handleOpen(o: boolean) {
    if (!o) { setData(null); setError(""); setConsulted(false) }
    onOpenChange(o)
  }

  const risk = data ? RISK_CONFIG[data.creditRisk] : null

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Consulta de Crédito — CNPJ
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500">Consultando Receita Federal...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Erro na consulta</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={consult}>Tentar novamente</Button>
            </div>
          </div>
        )}

        {data && risk && (
          <div className="space-y-4">
            {/* Empresa */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">{data.razaoSocial}</p>
                  {data.nomeFantasia && <p className="text-sm text-gray-500">{data.nomeFantasia}</p>}
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{data.cnpj}</p>
                </div>
                <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${
                  data.situacao === "ATIVA" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {data.situacao}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-gray-600">
                {data.dataAbertura && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    Abertura: {data.dataAbertura}
                  </div>
                )}
                {data.capitalSocial > 0 && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                    Capital: {formatCurrency(data.capitalSocial)}
                  </div>
                )}
                {data.telefone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {data.telefone}
                  </div>
                )}
                {data.email && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {data.email}
                  </div>
                )}
                {data.municipio && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {[data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>

              {data.atividadePrincipal && (
                <p className="text-xs text-gray-500 pt-1 border-t border-gray-200">
                  Atividade: {data.atividadePrincipal}
                </p>
              )}
            </div>

            {/* Score */}
            <div className={`rounded-xl p-4 border ${risk.bg} ${risk.border}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <risk.Icon className={`w-5 h-5 ${risk.color}`} />
                  <span className={`font-semibold text-sm ${risk.color}`}>Risco {risk.label}</span>
                </div>
                <span className={`text-2xl font-bold ${risk.color}`}>{data.creditScore}<span className="text-sm font-normal">/1000</span></span>
              </div>

              {/* Score bar */}
              <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all ${risk.bar}`} style={{ width: `${data.creditScore / 10}%` }} />
              </div>

              <div className="space-y-1.5">
                {data.creditNotes.map((note, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${risk.color}`} />
                    <span className={`text-xs ${risk.color}`}>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Limite sugerido */}
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs text-blue-600 font-medium">Limite de crédito sugerido</p>
                <p className="text-xl font-bold text-blue-900 mt-0.5">{formatCurrency(data.creditLimit)}</p>
              </div>
              {data.creditLimit > 0 && onApply && (
                <Button
                  size="sm"
                  onClick={() => {
                    onApply({ razaoSocial: data.razaoSocial, creditLimit: data.creditLimit })
                    handleOpen(false)
                  }}
                >
                  Aplicar ao cadastro
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
