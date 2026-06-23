import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Bot, GitBranch, Cpu, BarChart2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    icon: GitBranch,
    title: "Fluxos Condicionais",
    description: "Monte fluxos de conversa com condições, ramificações e respostas dinâmicas.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Cpu,
    title: "IA Integrada",
    description: "Conecte ao Claude ou ChatGPT para respostas inteligentes e contextuais.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: BarChart2,
    title: "Analytics",
    description: "Métricas de engajamento, taxa de resolução e satisfação dos usuários.",
    color: "bg-green-50 text-green-600",
  },
]

export default async function ChatbotPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div>
      <Header title="Chatbot" subtitle="Automação de atendimento inteligente" />

      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Bot className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Configure seu Chatbot</h2>
          <p className="text-gray-500 text-sm mb-8">
            Crie fluxos automatizados de atendimento integrados ao WhatsApp e outras plataformas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <Card key={f.title}>
                  <CardContent className="p-5 text-left">
                    <div
                      className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-3`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm mb-1">{f.title}</h3>
                    <p className="text-xs text-gray-500">{f.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {["Template Vendas", "Template Suporte", "Template FAQ", "Template Agendamento"].map((t) => (
              <button
                key={t}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                + Criar com template: {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
