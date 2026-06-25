import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ConfiguracoesClient } from "@/components/configuracoes/configuracoes-client"
import { ALL_MODULES, DEFAULT_PERMISSIONS } from "@/lib/module-permissions"
import { DEFAULT_CONFIG } from "@/app/api/configuracoes/relatorio-whatsapp/route"
import type { Role } from "@prisma/client"
import type { RelatorioWhatsappConfig } from "@/app/api/configuracoes/relatorio-whatsapp/route"

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [pipelines, categories, suppliers, alertConfig, savedPermissions, relatorioRecord, instances] = await Promise.all([
    db.pipeline.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { deals: true } } } }),
    db.productCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
    db.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
    db.stockAlertConfig.findUnique({ where: { userId: session.user.id } }),
    db.modulePermission.findMany(),
    db.systemConfig.findUnique({ where: { key: "relatorio_whatsapp" } }),
    db.whatsAppInstance.findMany({ orderBy: { name: "asc" } }),
  ])

  const modulePermissions: Record<string, Role[]> = {}
  for (const mod of ALL_MODULES) {
    const roles = savedPermissions.filter((p) => p.module === mod.key).map((p) => p.role as Role)
    modulePermissions[mod.key] = roles.length > 0 ? roles : (DEFAULT_PERMISSIONS[mod.key] ?? [])
  }

  let relatorioConfig: RelatorioWhatsappConfig = DEFAULT_CONFIG
  if (relatorioRecord) {
    try { relatorioConfig = JSON.parse(relatorioRecord.value) } catch {}
  }

  return (
    <div>
      <Header title="Configurações" subtitle="Gerencie pipelines, categorias, fornecedores, alertas, permissões e relatórios" />
      <ConfiguracoesClient
        pipelines={pipelines}
        categories={categories}
        suppliers={suppliers}
        alertConfig={alertConfig ?? { email: true, push: true, inApp: true }}
        modulePermissions={modulePermissions}
        isOwner={session.user.role === "OWNER"}
        relatorioConfig={relatorioConfig}
        instances={instances.map((i) => ({ id: i.id, name: i.name, connected: i.connected }))}
      />
    </div>
  )
}
