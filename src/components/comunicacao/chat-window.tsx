"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Send, Check, CheckCheck, UserCircle, ExternalLink, Paperclip, Mic, MicOff, X, FileAudio, FileVideo, FileText, Image, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getInitials, timeAgo } from "@/lib/utils"
import Link from "next/link"

interface Message {
  id: string
  direction: "INBOUND" | "OUTBOUND"
  body: string
  type: string
  mediaUrl?: string | null
  status: "SENT" | "DELIVERED" | "READ" | "FAILED"
  createdAt: string
  sender?: { id: string; name: string | null } | null
}

interface Conversation {
  id: string
  remoteJid: string
  status: "OPEN" | "RESOLVED" | "WAITING"
  contact?: { id: string; name: string } | null
  instance: { id: string; name: string; connected: boolean }
}

interface Props {
  conversation: Conversation
  onStatusChange: (id: string, status: "OPEN" | "RESOLVED" | "WAITING") => void
}

const STATUS_ICON = {
  SENT: <Check className="w-3 h-3 text-gray-400" />,
  DELIVERED: <CheckCheck className="w-3 h-3 text-gray-400" />,
  READ: <CheckCheck className="w-3 h-3 text-blue-400" />,
  FAILED: <span className="text-red-400 text-xs">!</span>,
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === "OUTBOUND"

  const content = () => {
    if (msg.type === "image" && msg.mediaUrl) {
      return (
        <div className="space-y-1.5">
          <img src={msg.mediaUrl} alt="imagem" className="rounded-xl max-w-[260px] max-h-[300px] object-cover cursor-pointer" onClick={() => window.open(msg.mediaUrl!, "_blank")} />
          {msg.body && msg.body !== "[imagem]" && <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>}
        </div>
      )
    }
    if (msg.type === "audio" && msg.mediaUrl) {
      return (
        <div className="flex items-center gap-2 min-w-[200px]">
          <FileAudio className="w-5 h-5 text-green-600 flex-shrink-0" />
          <audio controls className="h-8 flex-1" style={{ minWidth: 160 }}>
            <source src={msg.mediaUrl} />
          </audio>
        </div>
      )
    }
    if (msg.type === "video" && msg.mediaUrl) {
      return <video controls className="rounded-xl max-w-[260px]"><source src={msg.mediaUrl} /></video>
    }
    if (msg.type === "document" && msg.mediaUrl) {
      const name = msg.body !== "[documento]" ? msg.body : "Documento"
      return (
        <a href={msg.mediaUrl} download={name} className="flex items-center gap-2 text-blue-600 hover:underline text-sm">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="truncate max-w-[180px]">{name}</span>
        </a>
      )
    }
    return <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
  }

  return (
    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm ${isOut ? "bg-[#dcf8c6] text-gray-900 rounded-tr-sm" : "bg-white text-gray-900 rounded-tl-sm"}`}>
      {content()}
      <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
        <span className="text-[10px] text-gray-400">
          {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {isOut && STATUS_ICON[msg.status]}
      </div>
    </div>
  )
}

type AttachType = "image" | "video" | "document" | "audio-file"

interface Attachment {
  type: AttachType
  base64: string
  fileName: string
  mimetype: string
  preview?: string // only for images
  caption: string
}

export function ChatWindow({ conversation, onStatusChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Attachment state
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [attachMenu, setAttachMenu] = useState(false)

  // Audio recording
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingSecs, setRecordingSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/comunicacao/conversas/${conversation.id}/mensagens`, {
      cache: "no-store",
    })
    if (res.ok) setMessages(await res.json())
  }, [conversation.id])

  useEffect(() => {
    setLoading(true)
    fetchMessages().finally(() => setLoading(false))
    intervalRef.current = setInterval(fetchMessages, 3000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // ─── File to base64 ────────────────────────────────────────────────────────
  function readFile(file: File, type: AttachType) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setAttachment({
        type,
        base64,
        fileName: file.name,
        mimetype: file.type,
        preview: type === "image" ? base64 : undefined,
        caption: "",
      })
    }
    reader.readAsDataURL(file)
    setAttachMenu(false)
  }

  // ─── Audio recording ────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingSecs(0)
      timerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000)
    } catch { alert("Não foi possível acessar o microfone.") }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // ─── Send text ──────────────────────────────────────────────────────────────
  async function sendText() {
    if (!text.trim() || sending) return
    const body = text.trim()
    setText("")
    setSending(true)
    const temp: Message = { id: `temp-${Date.now()}`, direction: "OUTBOUND", body, type: "text", status: "SENT", createdAt: new Date().toISOString() }
    setMessages((prev) => [...prev, temp])
    try {
      setSendError(null)
      const res = await fetch("/api/comunicacao/mensagens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text", conversationId: conversation.id, body }),
      })
      const data = await res.json()
      if (data.sendError) setSendError(data.sendError)
      await fetchMessages()
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      setText(body)
    } finally { setSending(false) }
  }

  // ─── Send attachment ────────────────────────────────────────────────────────
  async function sendAttachment() {
    if (!attachment || sending) return
    setSending(true)
    const apiType = attachment.type === "audio-file" ? "audio" : attachment.type
    const temp: Message = {
      id: `temp-${Date.now()}`, direction: "OUTBOUND",
      body: attachment.caption || attachment.fileName,
      type: apiType,
      mediaUrl: attachment.preview ?? null,
      status: "SENT", createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, temp])
    setAttachment(null)
    try {
      setSendError(null)
      const res = await fetch("/api/comunicacao/mensagens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: apiType,
          conversationId: conversation.id,
          mediaBase64: attachment.base64,
          caption: attachment.caption || undefined,
          fileName: attachment.fileName,
          mimetype: attachment.mimetype,
        }),
      })
      const data = await res.json()
      if (data.sendError) setSendError(data.sendError)
      await fetchMessages()
    } finally { setSending(false) }
  }

  // ─── Send recorded audio ────────────────────────────────────────────────────
  async function sendRecordedAudio() {
    if (!audioBlob || sending) return
    setSending(true)
    try {
      // Convert blob to base64 via Promise (avoids callback timing issues)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(audioBlob)
      })
      const mimeType = audioBlob.type || "audio/webm"
      const temp: Message = { id: `temp-${Date.now()}`, direction: "OUTBOUND", body: "[áudio]", type: "audio", mediaUrl: base64, status: "SENT", createdAt: new Date().toISOString() }
      setMessages((prev) => [...prev, temp])
      setAudioBlob(null)
      setAudioUrl(null)
      setSendError(null)
      const res = await fetch("/api/comunicacao/mensagens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "audio", conversationId: conversation.id, mediaBase64: base64, fileName: "audio.webm", mimetype: mimeType }),
      })
      const data = await res.json()
      if (data.sendError) setSendError(data.sendError)
      await fetchMessages()
    } catch (err) {
      console.error("[sendRecordedAudio]", err)
      setSendError("Erro ao enviar áudio")
    } finally { setSending(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText() }
  }

  const rawPhone = conversation.remoteJid.replace(/:[0-9]+@.*$/, "").replace(/@[^@]*$/, "").replace(/[^0-9+]/g, "") || conversation.remoteJid
  const name = conversation.contact?.name ?? rawPhone

  const ATTACH_OPTIONS = [
    { type: "image" as AttachType, label: "Imagem", icon: Image, accept: "image/*", ref: imageInputRef },
    { type: "video" as AttachType, label: "Vídeo", icon: FileVideo, accept: "video/*", ref: videoInputRef },
    { type: "document" as AttachType, label: "Documento (PDF, Word...)", icon: FileText, accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/*", ref: docInputRef },
    { type: "audio-file" as AttachType, label: "Arquivo de áudio", icon: FileAudio, accept: "audio/*", ref: audioFileInputRef },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file inputs */}
      {ATTACH_OPTIONS.map(({ type, accept, ref }) => (
        <input key={type} ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, type); e.target.value = "" }} />
      ))}

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-semibold">
            {getInitials(name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 text-sm">{name}</p>
              {conversation.contact && (
                <Link href={`/crm/${conversation.contact.id}`} className="text-gray-400 hover:text-blue-600">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {rawPhone} · {conversation.instance.name}
              {!conversation.instance.connected && <span className="ml-1 text-red-400">· desconectado</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.status !== "RESOLVED" && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onStatusChange(conversation.id, "RESOLVED")}>
              <Check className="w-3.5 h-3.5 mr-1" /> Resolver
            </Button>
          )}
          {conversation.status === "RESOLVED" && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onStatusChange(conversation.id, "OPEN")}>Reabrir</Button>
          )}
          {conversation.contact && (
            <Link href={`/crm/${conversation.contact.id}`}>
              <Button size="sm" variant="ghost" className="h-8 text-xs"><UserCircle className="w-3.5 h-3.5 mr-1" /> Ver no CRM</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#efeae2]">
        {loading && messages.length === 0 && <div className="text-center text-gray-400 text-sm py-8">Carregando...</div>}
        {messages.map((msg, i) => {
          const isOut = msg.direction === "OUTBOUND"
          const prevMsg = messages[i - 1]
          const showTime = !prevMsg || new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000
          return (
            <div key={msg.id}>
              {showTime && (
                <div className="text-center my-3">
                  <span className="text-xs text-gray-500 bg-white/70 px-3 py-1 rounded-full">{timeAgo(msg.createdAt)}</span>
                </div>
              )}
              <div className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1`}>
                <MessageBubble msg={msg} />
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Attachment preview */}
      {attachment && (
        <div className="border-t border-gray-200 bg-white p-3 space-y-2">
          <div className="flex items-start gap-3">
            {attachment.preview ? (
              <img src={attachment.preview} alt="preview" className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center flex-shrink-0 text-gray-400">
                {attachment.type === "video" ? <FileVideo className="w-6 h-6" /> : attachment.type === "audio-file" ? <FileAudio className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                <span className="text-[10px] mt-1 text-center px-1 truncate w-full text-center">{attachment.fileName.split(".").pop()?.toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              <p className="text-xs text-gray-500 truncate">{attachment.fileName}</p>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Legenda (opcional)"
                value={attachment.caption}
                onChange={(e) => setAttachment((a) => a ? { ...a, caption: e.target.value } : a)}
                onKeyDown={(e) => e.key === "Enter" && sendAttachment()}
              />
              <div className="flex gap-2">
                <Button size="sm" className="bg-green-500 hover:bg-green-600 h-8 text-xs" onClick={sendAttachment} disabled={sending}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Enviar
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAttachment(null)}>
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recorded audio preview */}
      {audioUrl && !recording && (
        <div className="border-t border-gray-200 bg-white p-3 flex items-center gap-3">
          <audio controls src={audioUrl} className="h-9 flex-1" />
          <Button size="sm" className="bg-green-500 hover:bg-green-600 h-8 text-xs" onClick={sendRecordedAudio} disabled={sending}>
            <Send className="w-3.5 h-3.5 mr-1" /> Enviar
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAudioBlob(null); setAudioUrl(null) }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Send error */}
      {sendError && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-100 flex items-center justify-between gap-2">
          <p className="text-xs text-red-600">⚠️ Falha ao enviar: {sendError}. A mensagem foi salva localmente.</p>
          <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-gray-200 bg-white">
        {conversation.status === "RESOLVED" ? (
          <div className="text-center text-sm text-gray-400 py-2">
            Conversa resolvida.{" "}
            <button onClick={() => onStatusChange(conversation.id, "OPEN")} className="text-blue-600 hover:underline">Reabrir para responder</button>
          </div>
        ) : (
          <div className="space-y-2">
            {recording && (
              <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Gravando... {recordingSecs}s
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Attach menu */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setAttachMenu((p) => !p)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                  title="Anexar arquivo"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                {attachMenu && (
                  <div className="absolute bottom-12 left-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[220px]">
                    {ATTACH_OPTIONS.map(({ type, label, icon: Icon, ref }) => (
                      <button
                        key={type}
                        onClick={() => ref.current?.click()}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Icon className="w-4 h-4 text-gray-400" />
                        {label}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => { setAttachMenu(false); recording ? stopRecording() : startRecording() }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {recording ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-gray-400" />}
                        {recording ? `Parar gravação (${recordingSecs}s)` : "Gravar áudio"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem... (Enter para enviar)"
                rows={1}
                className="resize-none min-h-[40px] max-h-32 text-sm"
                disabled={recording}
              />
              <Button
                onClick={sendText}
                disabled={!text.trim() || sending || recording}
                size="sm"
                className="h-10 w-10 p-0 flex-shrink-0 bg-green-500 hover:bg-green-600"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
