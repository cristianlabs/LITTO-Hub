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
  return evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: name,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE"],
      },
    }),
  })
}

export async function getInstanceQR(instance: string) {
  return evolutionFetch(`/instance/connect/${instance}`)
}

export async function getInstanceStatus(instance: string) {
  return evolutionFetch(`/instance/connectionState/${instance}`)
}

export async function sendTextMessage(instance: string, to: string, text: string) {
  return evolutionFetch(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      number: to,
      text,
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
