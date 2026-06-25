import { db } from "@/lib/db"
import { sendOtpEmail } from "@/lib/email"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })

  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !user.password || !user.active) {
    // Delay to avoid timing attacks
    await new Promise((r) => setTimeout(r, 400))
    return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 })

  // Delete any existing unused tokens for this email
  await db.twoFactorToken.deleteMany({ where: { email, used: false } })

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

  await db.twoFactorToken.create({ data: { email, token: otp, expiresAt } })

  // Bypass emails skip the email send and receive the OTP directly in the response
  const bypassEmails = (process.env.TWO_FACTOR_BYPASS_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)

  if (bypassEmails.includes(email.toLowerCase())) {
    return NextResponse.json({ ok: true, bypass: true, otp })
  }

  try {
    await sendOtpEmail(email, otp, user.name)
  } catch (err) {
    console.error("[send-otp] Email error:", err)
    return NextResponse.json({ error: "Falha ao enviar e-mail de verificação" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
