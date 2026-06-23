import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Truck, CheckCircle, Clock, Settings } from "lucide-react"

export default async function NfePage() {
  const session = await auth()
  if (!session) redirect("/login")

  const stats = [
    { label: "NF-es Emitidas", value: 0, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Entregues", value: 0, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Em Trânsito", value: 0, icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Canhoto Pendente", value: 0, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
  ]

  return (
    <div>
      <Header title="NF-e & Canhoto" subtitle="Emissão de notas fiscais e confirmação de entrega" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <Settings className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Integração não configurada</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Configure sua chave da NFe.io para emitir notas fiscais eletrônicas.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Número</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Destinatário</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Valor</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Emissão</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  Nenhuma NF-e emitida
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
