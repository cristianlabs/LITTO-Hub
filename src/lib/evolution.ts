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
      webhookBase64: false,
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
      webhookBase64: false,
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

export async function sendTextMessage(instance: string, to: string, text: string) {
  return evolutionFetch(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      number: to,
      textMessage: { text },
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
