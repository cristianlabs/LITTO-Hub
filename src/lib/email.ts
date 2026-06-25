import nodemailer from "nodemailer"

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: (process.env.SMTP_PORT ?? "587") === "465",
    auth: {
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    },
  })
}

export async function sendOtpEmail(to: string, otp: string, userName?: string | null) {
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "noreply@sistema.com"
  const transporter = createTransport()

  await transporter.sendMail({
    from: `"Sistema Empresarial" <${from}>`,
    to,
    subject: "Código de verificação — Sistema Empresarial",
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, sans-serif; background: #f9fafb; margin: 0; padding: 40px 16px;">
        <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
          <div style="background: #2563EB; padding: 32px; text-align: center;">
            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              <span style="color: white; font-size: 22px; font-weight: bold;">SE</span>
            </div>
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Sistema Empresarial</h1>
          </div>
          <div style="padding: 40px 32px;">
            <p style="margin: 0 0 8px; color: #111827; font-size: 18px; font-weight: 600;">
              Olá${userName ? `, ${userName}` : ""}!
            </p>
            <p style="margin: 0 0 32px; color: #6b7280; font-size: 14px; line-height: 1.6;">
              Use o código abaixo para concluir o login. Ele expira em <strong>10 minutos</strong>.
            </p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Código de verificação</p>
              <p style="margin: 0; color: #111827; font-size: 40px; font-weight: 700; letter-spacing: 10px;">${otp}</p>
            </div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.6;">
              Se você não tentou fazer login, ignore este e-mail.<br>
              Nunca compartilhe este código com ninguém.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  })
}
