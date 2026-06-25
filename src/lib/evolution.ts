const BASE_URL = process.env.EVOLUTION_API_URL ?? "http://localhost:8080"
const API_KEY = process.env.EVOLUTION_API_KEY ?? ""

const headers = () => ({
  "Content-Type": "application/json",
  apikey: API_KEY,
})

export async function evolutionFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...(options?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Evolution API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function createInstance(name: string, webhookUrl: string) {
  const result = await evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: name,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      // v1 flat style
      webhook: webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE"],
    }),
  })
  // Also set via v2 endpoint (no-op on v1, required on v2)
  await setWebhook(name, webhookUrl).catch(() => null)
  return result
}

export async function setWebhook(instanceName: string, webhookUrl: string) {
  return evolutionFetch(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      url: webhookUrl,
      enabled: true,
      webhookByEvents: false,
      webhookBase64: true,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE"],
    }),
  })
}

export async function getInstanceQR(instance: string) {
  return evolutionFetch(`/instance/connect/${instance}`)
}

export async function getInstanceStatus(instance: string) {
  return evolutionFetch(`/instance/connectionState/${instance}`)
}

function normalizeNumber(to: string) {
  return to.replace(/:[0-9]+@.*$/, "").replace(/@.*$/, "").replace(/[^0-9]/g, "")
}

export async function sendTextMessage(instance: string, to: string, text: string) {
  const number = normalizeNumber(to)
  return evolutionFetch(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({ number, textMessage: { text } }),
  })
}

export async function sendMediaMessage(
  instance: string,
  to: string,
  mediatype: "image" | "video" | "document" | "audio",
  mediaBase64: string,
  caption?: string,
  fileName?: string,
  mimetype?: string,
) {
  const number = normalizeNumber(to)
  // Strip data URI prefix — everything up to and including the first comma
  const base64 = mediaBase64.includes(",") ? mediaBase64.split(",").slice(1).join(",") : mediaBase64

  const defaultNames: Record<string, string> = {
    image: "image.jpg", video: "video.mp4", document: "file.pdf", audio: "audio.ogg",
  }

  // Normalize audio mimetype to ogg — Evolution API handles it better than webm
  const resolvedMimetype = mediatype === "audio"
    ? (mimetype?.startsWith("audio/") ? mimetype : "audio/ogg")
    : mimetype
  const resolvedFileName = fileName ?? defaultNames[mediatype] ?? "file"

  return evolutionFetch(`/message/sendMedia/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      number,
      mediaMessage: {
        mediatype,
        media: base64,
        caption: caption ?? "",
        fileName: resolvedFileName,
        ...(resolvedMimetype ? { mimetype: resolvedMimetype } : {}),
      },
    }),
  })
}

export async function deleteInstance(instance: string) {
  return evolutionFetch(`/instance/delete/${instance}`, { method: "DELETE" })
}

export function normalizeJid(jid: string): string {
  // Remove @s.whatsapp.net or @g.us suffix, keep just the number
  return jid.replace(/@.*$/, "").replace(/[^0-9]/g, "")
}

export function toJid(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "")
  return `${digits}@s.whatsapp.net`
}
