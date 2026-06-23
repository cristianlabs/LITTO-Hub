"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ConversationList } from "./conversation-list"
import { ChatWindow } from "./chat-window"
import { InstanceSetup } from "./instance-setup"
import { MessageCircle, Settings, Filter } from "lucide-react"

interface Instance {
  id: string
  name: string
  phone?: string | null
  connected: boolean
  qrCode?: string | null
}

interface Conversation {
  id: string
  remoteJid: string
  lastMessage?: string | null
  lastMessageAt?: Date | null
  unreadCount: number
  status: "OPEN" | "RESOLVED" | "WAITING"
  contact?: { id: string; name: string } | null
  instance: { id: string; name: string; connected: boolean }
}

interface Props {
  initialInstances: Instance[]
  initialConversations: Conversation[]
}

type Tab = "chat" | "config"
type StatusFilter = "" | "OPEN" | "RESOLVED" | "WAITING"

export function ComunicacaoClient({ initialInstances, initialConversations }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [instances, setInstances] = useState(initialInstances)
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [tab, setTab] = useState<Tab>("chat")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("")

  const selectedConversation = conversations.find((c) => c.id === selectedId)

  async function refreshConversations() {
    const url = statusFilter ? `/api/comunicacao/conversas?status=${statusFilter}` : "/api/comunicacao/conversas"
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setConversations(data)
    }
  }

  async function refreshInstances() {
    const res = await fetch("/api/comunicacao/instancias")
    if (res.ok) setInstances(await res.json())
  }

  async function handleStatusChange(id: string, status: "OPEN" | "RESOLVED" | "WAITING") {
    await fetch("/api/comunicacao/conversas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }

  const filteredConversations = conversations.filter((c) =>
    statusFilter ? c.status === statusFilter : true,
  )

  const serializedConversations = filteredConversations.map((c) => ({
    ...c,
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
  }))

  const serializedSelected = selectedConversation
    ? { ...selectedConversation, lastMessageAt: selectedConversation.lastMessageAt?.toISOString() ?? null }
    : null

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
  const noInstances = instances.length === 0

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-200 bg-white">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
              tab === "chat"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Conversas
            {totalUnread > 0 && (
              <span className="w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("config")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
              tab === "config"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Settings className="w-4 h-4" />
            Instâncias
          </button>
        </div>

        {tab === "chat" && (
          <>
            {/* Status filter */}
            <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
              {(["", "OPEN", "WAITING", "RESOLVED"] as StatusFilter[]).map((s) => {
                const labels = { "": "Todas", OPEN: "Abertas", WAITING: "Aguardando", RESOLVED: "Resolvidas" }
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {labels[s]}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-hidden">
              {noInstances ? (
                <div className="text-center px-6 py-12">
                  <MessageCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 font-medium">Nenhuma instância configurada</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Vá em <button onClick={() => setTab("config")} className="text-blue-500 hover:underline">Instâncias</button> para conectar um número.
                  </p>
                </div>
              ) : (
                <ConversationList
                  conversations={serializedConversations}
                  selectedId={selectedId}
                  onSelect={(c) => setSelectedId(c.id)}
                />
              )}
            </div>
          </>
        )}

        {tab === "config" && (
          <div className="flex-1 overflow-y-auto">
            <InstanceSetup instances={instances} onRefresh={refreshInstances} />
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {serializedSelected ? (
          <ChatWindow
            conversation={serializedSelected}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-14 h-14 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">
                {noInstances ? "Configure uma instância para começar" : "Selecione uma conversa"}
              </p>
              {noInstances && (
                <button
                  onClick={() => setTab("config")}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Ir para Instâncias →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
