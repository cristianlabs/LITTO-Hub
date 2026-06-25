import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { hasMinRole } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
}

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER"))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo muito grande (máx 20 MB)" }, { status: 400 })

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "Tipo não permitido. Use PDF ou DOCX." }, { status: 400 })

  const fileName = `${randomUUID()}${ext}`
  const uploadDir = join(process.cwd(), "public", "uploads", "treinamentos")

  await mkdir(uploadDir, { recursive: true })
  const bytes = await file.arrayBuffer()
  await writeFile(join(uploadDir, fileName), Buffer.from(bytes))

  return NextResponse.json({ url: `/uploads/treinamentos/${fileName}`, name: file.name })
}
