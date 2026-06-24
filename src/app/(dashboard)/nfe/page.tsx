import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { NfeClient } from "@/components/nfe/nfe-client"

export default async function NfePage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [rawNotes, purchaseOrders] = await Promise.all([
    db.fiscalNote.findMany({
      orderBy: { emittedAt: "desc" },
      include: {
        canhoto: true,
        purchaseOrder: { select: { id: true, number: true, title: true } },
      },
    }),
    db.purchaseOrder.findMany({
      select: { id: true, number: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const notes = rawNotes.map((n) => ({
    ...n,
    totalValue: Number(n.totalValue),
    emittedAt: n.emittedAt.toISOString(),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    canhoto: n.canhoto
      ? {
          ...n.canhoto,
          receivedAt: n.canhoto.receivedAt.toISOString(),
          createdAt: n.canhoto.createdAt.toISOString(),
        }
      : null,
  }))

  return (
    <div>
      <Header title="NF-e & Canhoto" subtitle="Notas fiscais e confirmações de entrega" />
      <NfeClient initialNotes={notes} purchaseOrders={purchaseOrders} />
    </div>
  )
}
