import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { db } from "@/lib/db"
import type { Role } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
      customRoleName?: string | null
    }
  }
  interface User {
    role: Role
    customRoleName?: string | null
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z.string().optional(),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
        otp: { label: "Código", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password, otp } = parsed.data

        const user = await db.user.findUnique({
          where: { email },
          include: { customRole: { select: { name: true } } },
        })

        if (!user || !user.password || !user.active) return null

        const validPassword = await bcrypt.compare(password, user.password)
        if (!validPassword) return null

        // Validate OTP if provided
        if (otp) {
          const record = await db.twoFactorToken.findFirst({
            where: { email, token: otp, used: false },
            orderBy: { createdAt: "desc" },
          })
          if (!record || record.expiresAt < new Date()) return null
          await db.twoFactorToken.update({ where: { id: record.id }, data: { used: true } })
        } else {
          // No OTP provided — should not reach here in normal flow
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          customRoleName: user.customRole?.name ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.customRoleName = user.customRoleName
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.customRoleName = token.customRoleName as string | null
      }
      return session
    },
  },
})
