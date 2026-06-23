import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createInstance, getInstanceStatus, deleteInstance, getInstanceQR } from "@/lib/evolution"

const createSchema = z.object({ name: z.string().min(1) })

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const instances = await db.whatsAppInstance.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json(instances)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/evolution`

  // Create in Evolution API
  let evolutionData: Record<string, unknown> = {}
  try {
    evolutionData = await createInstance(parsed.data.name, webhookUrl)
  } catch (err) {
    console.error("[instancias POST] Evolution API error:", err)
    // Continue — save locally even if Evolution is offline (dev mode)
  }

  const instance = await db.whatsAppInstance.create({
    data: {
      name: parsed.data.name,
      webhookUrl,
    },
  })

  return NextResponse.json({ instance, evolution: evolutionData }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const instance = await db.whatsAppInstance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    await deleteInstance(instance.name)
  } catch {}

  await db.whatsAppInstance.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

// GET QR code for an instance
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, action } = await req.json()
  const instance = await db.whatsAppInstance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (action === "qr") {
    try {
      const qr = await getInstanceQR(instance.name)
      const qrCode = qr?.base64 ?? qr?.qrcode?.base64 ?? null
      if (qrCode) {
        await db.whatsAppInstance.update({ where: { id }, data: { qrCode } })
      }
      return NextResponse.json({ qrCode })
    } catch (err) {
      return NextResponse.json({ error: "Evolution API indisponível" }, { status: 503 })
    }
  }

  if (action === "status") {
    try {
      const status = await getInstanceStatus(instance.name)
      const connected = status?.instance?.state === "open"
      await db.whatsAppInstance.update({ where: { id }, data: { connected } })
      return NextResponse.json({ connected, state: status?.instance?.state })
    } catch {
      return NextResponse.json({ connected: false, state: "unknown" })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
