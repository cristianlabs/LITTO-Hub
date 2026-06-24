"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Download } from "lucide-react"

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Arquivo inválido. Use .xlsx, .xls ou .csv")
      return
    }
    setFile(f)
    setResult(null)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/estoque/importar", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? "Erro na importação"); return }
      setResult(data)
      if (data.created > 0 || data.updated > 0) onSuccess()
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFile(null)
    setResult(null)
  }

  function downloadTemplate() {
    const csv = [
      "sku,nome,descricao,categoria,fornecedor,preco_custo,preco_venda,unidade,estoque,estoque_minimo,estoque_maximo",
      "PROD-001,Camiseta Básica,Camiseta algodão 100%,Vestuário,Fornecedor A,25.00,59.90,un,50,10,200",
      "PROD-002,Calça Jeans,Calça slim fit,Vestuário,Fornecedor B,80.00,189.90,un,30,5,100",
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "modelo_importacao_estoque.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Importar Planilha de Produtos
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Template download */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Modelo de planilha</p>
                <p className="text-xs text-gray-500">Baixe o CSV modelo para preencher</p>
              </div>
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar modelo
              </Button>
            </div>

            {/* Colunas aceitas */}
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-700">Colunas reconhecidas:</p>
              <div className="grid grid-cols-2 gap-x-4">
                <span><span className="font-mono bg-gray-100 px-1 rounded">sku</span> — código do produto</span>
                <span><span className="font-mono bg-gray-100 px-1 rounded">nome</span> — obrigatório</span>
                <span><span className="font-mono bg-gray-100 px-1 rounded">categoria</span> — cria se não existir</span>
                <span><span className="font-mono bg-gray-100 px-1 rounded">fornecedor</span> — nome exato</span>
                <span><span className="font-mono bg-gray-100 px-1 rounded">preco_custo</span> / <span className="font-mono bg-gray-100 px-1 rounded">preco_venda</span></span>
                <span><span className="font-mono bg-gray-100 px-1 rounded">estoque</span> / <span className="font-mono bg-gray-100 px-1 rounded">estoque_minimo</span></span>
              </div>
              <p className="text-gray-400 mt-1">Produtos com SKU existente serão <strong>atualizados</strong>. Sem SKU, um código é gerado automaticamente.</p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-10 text-center cursor-pointer transition-colors ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="ml-2 text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">Arraste o arquivo ou clique para selecionar</p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx, .xls ou .csv</p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!file || loading}>
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando...</span>
                ) : (
                  <span className="flex items-center gap-2"><Upload className="w-3.5 h-3.5" />Importar</span>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Results screen */
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600 mt-0.5">Criados</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600 mt-0.5">Atualizados</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
                <p className="text-xs text-gray-500 mt-0.5">Pulados</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4" /> {result.errors.length} erro{result.errors.length !== 1 ? "s" : ""}
                </p>
                <ul className="space-y-1 max-h-36 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-600">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.created === 0 && result.updated === 0 ? (
              <p className="text-sm text-gray-500 text-center">Nenhum produto importado.</p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Estoque atualizado com sucesso!
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
              <Button onClick={() => { reset(); onOpenChange(false) }}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
