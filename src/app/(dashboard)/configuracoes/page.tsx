import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Settings } from "lucide-react"

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div>
      <Header title="Configurações" subtitle="Preferências do sistema" />
      <div className="p-6 flex items-center justify-center py-20">
        <div className="text-center">
          <Settings className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Configurações em desenvolvimento</p>
        </div>
      </div>
    </div>
  )
}
