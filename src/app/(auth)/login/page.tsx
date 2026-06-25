"use client"

import { useState, useRef, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ArrowLeft, ShieldCheck, Loader2, Mail, Lock } from "lucide-react"

type Step = "credentials" | "otp"

export default function LoginPage() {
  const router = useRouter()

  // Step 1
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)

  // Step 2
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const [step, setStep] = useState<Step>("credentials")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  // ── Step 1: send OTP ──────────────────────────────────────────────────────
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar código")
      } else if (data.bypass && data.otp) {
        // Bypass mode: auto-fill and submit without showing OTP screen
        setStep("otp")
        const digits = String(data.otp).split("")
        setOtp(digits)
        await handleOtp(String(data.otp))
      } else {
        setStep("otp")
        setResendCooldown(60)
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      }
    } catch {
      setError("Falha na conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: verify OTP + sign in ─────────────────────────────────────────
  async function handleOtp(code: string) {
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email,
      password,
      otp: code,
      redirect: false,
    })

    if (result?.error) {
      setError("Código inválido ou expirado.")
      setOtp(["", "", "", "", "", ""])
      otpRefs.current[0]?.focus()
      setLoading(false)
    } else {
      router.push("/")
    }
  }

  // ── OTP input handlers ────────────────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }

    if (next.every((d) => d !== "") && digit) {
      handleOtp(next.join(""))
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (digits.length === 6) {
      setOtp(digits.split(""))
      handleOtp(digits)
    }
  }

  async function resendOtp() {
    if (resendCooldown > 0) return
    setLoading(true)
    try {
      await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      setResendCooldown(60)
      setOtp(["", "", "", "", "", ""])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 bg-white/5 rounded-full" />
        <div className="absolute top-1/3 right-8 w-48 h-48 bg-white/5 rounded-full" />

        <div className="relative z-10 text-center text-white">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/20">
            <span className="text-white font-bold text-3xl">SE</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Sistema Empresarial</h1>
          <p className="text-blue-200 text-lg leading-relaxed max-w-xs">
            Gerencie sua empresa com eficiência e segurança em um só lugar.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            {[
              { icon: "📊", label: "Financeiro", desc: "Controle completo" },
              { icon: "🤝", label: "CRM", desc: "Gestão de clientes" },
              { icon: "📦", label: "Estoque", desc: "Controle em tempo real" },
              { icon: "💬", label: "Comunicação", desc: "WhatsApp integrado" },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-white font-medium text-sm mt-1">{item.label}</p>
                <p className="text-blue-200 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-10">
            <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${step === "credentials" ? "bg-blue-600" : "bg-green-500"}`} />
            <div className={`h-px flex-1 transition-colors duration-300 ${step === "otp" ? "bg-blue-600" : "bg-gray-200"}`} />
            <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${step === "otp" ? "bg-blue-600" : "bg-gray-200"}`} />
          </div>

          {/* ── STEP 1: Credentials ── */}
          {step === "credentials" && (
            <div>
              <div className="mb-8">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-5">
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h2>
                <p className="text-gray-500 mt-1.5">Entre com suas credenciais para continuar</p>
              </div>

              <form onSubmit={handleCredentials} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-11 h-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    <span>⚠</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Verificando...</>
                  ) : "Continuar →"}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === "otp" && (
            <div>
              <div className="mb-8">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-5">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Verificação em 2 etapas</h2>
                <p className="text-gray-500 mt-1.5">
                  Enviamos um código de 6 dígitos para<br />
                  <span className="font-semibold text-gray-700">{email}</span>
                </p>
              </div>

              {/* OTP boxes */}
              <div className="flex gap-3 justify-center mb-7" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    disabled={loading}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none disabled:opacity-40 ${
                      digit
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-900 focus:border-blue-400 focus:bg-blue-50/40"
                    }`}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
                  <span>⚠</span> {error}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando código...
                </div>
              )}

              <div className="flex items-center justify-between text-sm mt-2">
                <button
                  onClick={() => { setStep("credentials"); setError(""); setOtp(["","","","","",""]) }}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Usar outro email
                </button>

                <button
                  onClick={resendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 transition-colors font-medium"
                >
                  {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center mt-6">
                Não encontrou? Verifique a pasta de spam.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
