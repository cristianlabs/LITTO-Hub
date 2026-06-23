import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { MessageCircle, Phone } from "lucide-react"

export default async function ComunicacaoPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex flex-col h-full">
      <Header title="Comunicação" subtitle="WhatsApp, chat e VoIP integrados" />

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations list */}
        <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-medium text-sm text-gray-700">Conversas</h3>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-6">
              <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Nenhuma conversa</p>
              <p className="text-xs text-gray-400 mt-1">
                Configure a Evolution API para começar a receber mensagens do WhatsApp.
              </p>
              <a
                href="#"
                className="inline-block mt-3 text-xs text-blue-600 hover:underline"
              >
                Configurar Evolution API →
              </a>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center px-8">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Selecione uma conversa</p>
              <p className="text-sm text-gray-400 mt-1">
                As mensagens do WhatsApp aparecerão aqui após a configuração.
              </p>
            </div>
          </div>

          {/* VoIP section */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">VoIP — Twilio</p>
                <p className="text-xs text-gray-400">
                  Integração não configurada.{" "}
                  <a href="#" className="text-blue-600 hover:underline">
                    Configurar Twilio →
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
