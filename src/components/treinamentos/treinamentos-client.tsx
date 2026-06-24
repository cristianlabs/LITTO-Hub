"use client"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  BookOpen, Video, FileText, Plus, Pencil, Trash2,
  ChevronLeft, CheckCircle2, Circle, Clock, Play, ExternalLink,
  BarChart2, Eye, EyeOff,
} from "lucide-react"
import type { LmsCategory } from "@prisma/client"

interface Lesson {
  id: string
  title: string
  content: string | null
  videoUrl: string | null
  fileUrl: string | null
  duration: number | null
  order: number
  completed?: boolean
}

interface Course {
  id: string
  title: string
  description: string | null
  category: LmsCategory
  published: boolean
  order: number
  lessons: Lesson[]
  _count: { lessons: number }
}

interface Props {
  initialCourses: Course[]
  progress: Record<string, boolean>
  canManage: boolean
  userId: string
}

const CATEGORIES: { key: LmsCategory; label: string; icon: typeof BookOpen; color: string }[] = [
  { key: "PRODUCT_MANUAL", label: "Manuais de Produto", icon: FileText, color: "bg-blue-50 text-blue-700" },
  { key: "SALES_TRAINING", label: "Treinamento de Vendas", icon: Video, color: "bg-green-50 text-green-700" },
  { key: "COMPANY_RULES", label: "Regras da Empresa", icon: BookOpen, color: "bg-purple-50 text-purple-700" },
  { key: "OTHER", label: "Outros", icon: BookOpen, color: "bg-gray-50 text-gray-700" },
]

const courseSchema = z.object({
  title: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  category: z.enum(["PRODUCT_MANUAL", "SALES_TRAINING", "COMPANY_RULES", "OTHER"]),
  published: z.boolean().optional(),
})

const lessonSchema = z.object({
  title: z.string().min(1, "Obrigatório"),
  content: z.string().optional(),
  videoUrl: z.string().optional(),
  duration: z.coerce.number().optional(),
})

type CourseData = z.infer<typeof courseSchema>
type LessonData = z.infer<typeof lessonSchema>

export function TreinamentosClient({ initialCourses, progress: initialProgress, canManage }: Props) {
  const [courses, setCourses] = useState(initialCourses)
  const [progress, setProgress] = useState(initialProgress)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [createCourseOpen, setCreateCourseOpen] = useState(false)
  const [editCourse, setEditCourse] = useState<Course | null>(null)
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null)
  const [addLessonOpen, setAddLessonOpen] = useState(false)
  const [deleteLesson, setDeleteLesson] = useState<{ id: string; title: string } | null>(null)
  const [filter, setFilter] = useState<LmsCategory | "ALL">("ALL")

  const { register: rC, handleSubmit: hC, reset: resetC, formState: { errors: eC, isSubmitting: sC } } = useForm<CourseData>({
    resolver: zodResolver(courseSchema) as never,
    defaultValues: { category: "PRODUCT_MANUAL", published: false },
  })
  const { register: rL, handleSubmit: hL, reset: resetL, formState: { errors: eL, isSubmitting: sL } } = useForm<LessonData>({
    resolver: zodResolver(lessonSchema) as never,
  })

  const refreshCourses = useCallback(async () => {
    const res = await fetch("/api/treinamentos/cursos")
    if (res.ok) {
      const data = await res.json()
      setCourses(data)
      if (selectedCourse) {
        setSelectedCourse(data.find((c: Course) => c.id === selectedCourse.id) ?? null)
      }
    }
  }, [selectedCourse])

  async function onCreateCourse(data: CourseData) {
    const res = await fetch("/api/treinamentos/cursos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) { setCreateCourseOpen(false); resetC(); await refreshCourses() }
  }

  async function onEditCourse(data: CourseData) {
    if (!editCourse) return
    await fetch(`/api/treinamentos/cursos/${editCourse.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setEditCourse(null); resetC(); await refreshCourses()
  }

  async function confirmDeleteCourse() {
    if (!deleteCourse) return
    await fetch(`/api/treinamentos/cursos/${deleteCourse.id}`, { method: "DELETE" })
    setDeleteCourse(null)
    if (selectedCourse?.id === deleteCourse.id) setSelectedCourse(null)
    await refreshCourses()
  }

  async function togglePublish(course: Course) {
    await fetch(`/api/treinamentos/cursos/${course.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !course.published }),
    })
    await refreshCourses()
  }

  async function onAddLesson(data: LessonData) {
    if (!selectedCourse) return
    await fetch(`/api/treinamentos/cursos/${selectedCourse.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_lesson", ...data }),
    })
    setAddLessonOpen(false); resetL(); await refreshCourses()
  }

  async function confirmDeleteLesson() {
    if (!deleteLesson || !selectedCourse) return
    await fetch(`/api/treinamentos/cursos/${selectedCourse.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_lesson", lessonId: deleteLesson.id }),
    })
    setDeleteLesson(null); await refreshCourses()
  }

  async function toggleLessonProgress(courseId: string, lessonId: string, completed: boolean) {
    const key = `${courseId}:${lessonId}`
    setProgress((prev) => ({ ...prev, [key]: completed }))
    await fetch(`/api/treinamentos/cursos/${courseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "progress", lessonId, completed }),
    })
  }

  function getCourseProgress(course: Course) {
    if (course.lessons.length === 0) return 0
    const done = course.lessons.filter((l) => progress[`${course.id}:${l.id}`]).length
    return Math.round((done / course.lessons.length) * 100)
  }

  const visibleCourses = courses.filter((c) =>
    (canManage || c.published) && (filter === "ALL" || c.category === filter)
  )

  // ── Course detail view ──────────────────────────────────────────────────────
  if (selectedCourse) {
    const pct = getCourseProgress(selectedCourse)
    const catInfo = CATEGORIES.find((c) => c.key === selectedCourse.category)!
    const CatIcon = catInfo.icon

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCourse(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium">{selectedCourse.title}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${catInfo.color}`}>
                <CatIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedCourse.title}</h2>
                {selectedCourse.description && (
                  <p className="text-sm text-gray-500 mt-1">{selectedCourse.description}</p>
                )}
                <span className={`inline-flex mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${catInfo.color}`}>
                  {catInfo.label}
                </span>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => togglePublish(selectedCourse)}
                  title={selectedCourse.published ? "Despublicar" : "Publicar"}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  {selectedCourse.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => {
                  setEditCourse(selectedCourse)
                  resetC({ title: selectedCourse.title, description: selectedCourse.description ?? "", category: selectedCourse.category, published: selectedCourse.published })
                }} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {selectedCourse.lessons.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5" /> Seu progresso</span>
                <span className="font-semibold text-gray-700">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Aulas <span className="text-gray-400 font-normal">({selectedCourse.lessons.length})</span>
            </h3>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setAddLessonOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar aula
              </Button>
            )}
          </div>

          {selectedCourse.lessons.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-14 text-center">
              <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma aula ainda</p>
              {canManage && (
                <button onClick={() => setAddLessonOpen(true)}
                  className="mt-3 text-xs text-blue-600 hover:underline">
                  + Adicionar primeira aula
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {selectedCourse.lessons.map((lesson, idx) => {
                const done = progress[`${selectedCourse.id}:${lesson.id}`] ?? false
                return (
                  <div key={lesson.id}
                    className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-colors ${done ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
                    <button onClick={() => toggleLessonProgress(selectedCourse.id, lesson.id, !done)}
                      className="mt-0.5 shrink-0 transition-colors">
                      {done
                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-500" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">Aula {idx + 1}</span>
                        {done && <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded font-medium">Concluída</span>}
                      </div>
                      <p className={`font-medium mt-0.5 ${done ? "text-gray-500 line-through" : "text-gray-900"}`}>
                        {lesson.title}
                      </p>
                      {lesson.content && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{lesson.content}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {lesson.duration && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" /> {lesson.duration} min
                          </span>
                        )}
                        {lesson.videoUrl && (
                          <a href={lesson.videoUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Play className="w-3 h-3" /> Assistir vídeo
                          </a>
                        )}
                        {lesson.fileUrl && (
                          <a href={lesson.fileUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLink className="w-3 h-3" /> Material
                          </a>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <button onClick={() => setDeleteLesson({ id: lesson.id, title: lesson.title })}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add lesson sheet */}
        <Sheet open={addLessonOpen} onOpenChange={setAddLessonOpen}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader className="mb-6"><SheetTitle>Nova Aula</SheetTitle></SheetHeader>
            <form onSubmit={hL(onAddLesson)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input {...rL("title")} placeholder="Título da aula" />
                {eL.title && <p className="text-red-500 text-xs">{eL.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo / Descrição</Label>
                <textarea {...rL("content")} rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="Descrição ou anotações da aula..." />
              </div>
              <div className="space-y-1.5">
                <Label>URL do Vídeo</Label>
                <Input {...rL("videoUrl")} placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (minutos)</Label>
                <Input {...rL("duration")} type="number" min={1} placeholder="Ex: 15" />
              </div>
              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setAddLessonOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={sL}>{sL ? "Salvando..." : "Adicionar aula"}</Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>

        {/* Delete lesson dialog */}
        <AlertDialog open={!!deleteLesson} onOpenChange={(o) => !o && setDeleteLesson(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
              <AlertDialogDescription>"{deleteLesson?.title}" será excluída permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteLesson} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit course sheet */}
        <Sheet open={!!editCourse} onOpenChange={(o) => !o && setEditCourse(null)}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader className="mb-6"><SheetTitle>Editar Curso</SheetTitle></SheetHeader>
            <form onSubmit={hC(onEditCourse)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input {...rC("title")} />
                {eC.title && <p className="text-red-500 text-xs">{eC.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <textarea {...rC("description")} rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <select {...rC("category")} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditCourse(null)}>Cancelar</Button>
                <Button type="submit" disabled={sC}>{sC ? "Salvando..." : "Salvar"}</Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  // ── Course list view ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const total = courses.filter((c) => c.category === cat.key && (canManage || c.published)).length
          const completed = courses
            .filter((c) => c.category === cat.key && (canManage || c.published))
            .filter((c) => c.lessons.length > 0 && c.lessons.every((l) => progress[`${c.id}:${l.id}`]))
            .length
          return (
            <button key={cat.key} onClick={() => setFilter(filter === cat.key ? "ALL" : cat.key)}
              className={`bg-white border rounded-xl p-4 text-left transition-all hover:shadow-md ${filter === cat.key ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-gray-500 font-medium">{cat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-400">{completed} concluído{completed !== 1 ? "s" : ""}</p>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {visibleCourses.length} curso{visibleCourses.length !== 1 ? "s" : ""}
          {filter !== "ALL" && ` em "${CATEGORIES.find((c) => c.key === filter)?.label}"`}
        </p>
        {canManage && (
          <Button size="sm" onClick={() => { setCreateCourseOpen(true); resetC({ category: "PRODUCT_MANUAL", published: false }) }}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo curso
          </Button>
        )}
      </div>

      {/* Course grid */}
      {visibleCourses.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-20 text-center">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum curso disponível</p>
          {canManage && (
            <button onClick={() => setCreateCourseOpen(true)} className="mt-2 text-sm text-blue-600 hover:underline">
              Criar primeiro curso
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCourses.map((c) => {
            const pct = getCourseProgress(c)
            const catInfo = CATEGORIES.find((x) => x.key === c.category)!
            const CatIcon = catInfo.icon
            return (
              <div key={c.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer group flex flex-col"
                onClick={() => setSelectedCourse(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catInfo.color}`}>
                    <CatIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!c.published && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Rascunho</span>
                    )}
                    {canManage && (
                      <>
                        <button onClick={() => {
                          setEditCourse(c)
                          resetC({ title: c.title, description: c.description ?? "", category: c.category, published: c.published })
                        }} className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteCourse(c)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 mt-3 mb-1">{c.title}</h4>
                {c.description && <p className="text-xs text-gray-500 line-clamp-2">{c.description}</p>}
                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>{c.lessons.length} aula{c.lessons.length !== 1 ? "s" : ""}</span>
                    <span className={pct === 100 ? "text-green-600 font-semibold" : ""}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create course sheet */}
      <Sheet open={createCourseOpen} onOpenChange={setCreateCourseOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="mb-6"><SheetTitle>Novo Curso</SheetTitle></SheetHeader>
          <form onSubmit={hC(onCreateCourse)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input {...rC("title")} placeholder="Nome do curso" />
              {eC.title && <p className="text-red-500 text-xs">{eC.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <textarea {...rC("description")} rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Do que se trata este curso..." />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <select {...rC("category")} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateCourseOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={sC}>{sC ? "Criando..." : "Criar curso"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit course sheet */}
      <Sheet open={!!editCourse} onOpenChange={(o) => !o && setEditCourse(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="mb-6"><SheetTitle>Editar Curso</SheetTitle></SheetHeader>
          <form onSubmit={hC(onEditCourse)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input {...rC("title")} />
              {eC.title && <p className="text-red-500 text-xs">{eC.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <textarea {...rC("description")} rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <select {...rC("category")} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditCourse(null)}>Cancelar</Button>
              <Button type="submit" disabled={sC}>{sC ? "Salvando..." : "Salvar"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete course dialog */}
      <AlertDialog open={!!deleteCourse} onOpenChange={(o) => !o && setDeleteCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteCourse?.title}" e todas as suas aulas serão excluídos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCourse} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
