import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ConfiguracoesClient } from "@/components/configuracoes/configuracoes-client"

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [pipelines, categories, suppliers, alertConfig] = await Promise.all([
    db.pipeline.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { deals: true } } },
    }),
    db.productCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    db.stockAlertConfig.findUnique({ where: { userId: session.user.id } }),
  ])

  return (
    <div>
      <Header title="Configurações" subtitle="Gerencie pipelines, categorias, fornecedores e alertas" />
      <ConfiguracoesClient
        pipelines={pipelines}
        categories={categories}
        suppliers={suppliers}
        alertConfig={alertConfig ?? { email: true, push: true, inApp: true }}
      />
    </div>
  )
}
