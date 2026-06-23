"use client"

import { timeAgo, getInitials } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useState } from "react"

interface Conversation {
  id: string
  remoteJid: string
  lastMessage?: string | null
  lastMessageAt?: string | null
  unreadCount: number
  status: "OPEN" | "RESOLVED" | "WAITING"
  contact?: { id: string; name: string } | null
  instance: { id: string; name: string; connected: boolean }
}

interface Props {
  conversations: Conversation[]
  selectedId?: string
  onSelect: (conv: Conversation) => void
}

const STATUS_DOT: Record<string, string> = {
  OPEN: "bg-green-400",
  WAITING: "bg-yellow-400",
  RESOLVED: "bg-gray-300",
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const [q, setQ] = useState("")

  const filtered = conversations.filter((c) => {
    if (!q) return true
    const name = c.contact?.name ?? c.remoteJid
    return name.toLowerCase().includes(q.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar conversa..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhuma conversa
          </div>
        )}
        {filtered.map((conv) => {
          const name = conv.contact?.name ?? conv.remoteJid.replace(/@.*$/, "")
          const isSelected = conv.id === selectedId

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50",
                isSelected && "bg-blue-50 hover:bg-blue-50 border-l-2 border-l-blue-500",
              )}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(name)}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${STATUS_DOT[conv.status]}`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn("text-sm font-medium truncate", isSelected ? "text-blue-700" : "text-gray-900")}>
                    {name}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 truncate">{conv.lastMessage ?? "..."}</p>
                  {conv.unreadCount > 0 && (
                    <span className="flex-shrink-0 ml-1 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
