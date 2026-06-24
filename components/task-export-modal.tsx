"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { useApp } from "@/contexts/app-context"
import {
  downloadTaskExport,
  getTaskExportJob,
  startTaskExport,
  type TaskExportField,
  type TaskExportJob,
} from "@/lib/api"
import type { TaskStatus } from "@/lib/types"
import { STATUS_COLORS } from "@/lib/types"

interface TaskExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EXPORT_STATUSES: TaskStatus[] = [
  "не в работе",
  "в аналитике",
  "на согласовании",
  "оценка",
  "ревью",
  "готова к разработке",
  "разработка",
  "завершена",
]

const EXPORT_FIELDS: Array<{ key: TaskExportField; label: string }> = [
  { key: "id", label: "ID" },
  { key: "title", label: "Название" },
  { key: "status", label: "Статус" },
  { key: "priority", label: "Приоритет" },
  { key: "assignee", label: "Исполнитель" },
  { key: "approved_hours", label: "Согласовано часов" },
  { key: "spent_hours", label: "Затрачено часов" },
  { key: "link_url", label: "Ссылка на задачу в JIRA" },
  { key: "start_at", label: "Дата начала" },
  { key: "due_at", label: "Дата окончания" },
  { key: "tags", label: "Теги" },
  { key: "description", label: "Описание" },
]

type ExportPhase = "idle" | "running" | "done" | "error"

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function TaskExportModal({ open, onOpenChange }: TaskExportModalProps) {
  const { tasks } = useApp()
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>(EXPORT_STATUSES)
  const [selectedFields, setSelectedFields] = useState<TaskExportField[]>(
    EXPORT_FIELDS.map((field) => field.key),
  )
  const [phase, setPhase] = useState<ExportPhase>("idle")
  const [job, setJob] = useState<TaskExportJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const statusCounts = useMemo(() => {
    return tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {})
  }, [tasks])

  const progress = job?.progress ?? 0
  const canStart = selectedStatuses.length > 0 && selectedFields.length > 0 && phase !== "running"

  useEffect(() => {
    if (!job?.id || phase !== "running") return

    let active = true
    let loading = false

    const poll = async () => {
      if (loading) return
      loading = true
      try {
        const next = await getTaskExportJob(job.id)
        if (!active) return
        setJob(next)
        if (next.status === "done") {
          setPhase("done")
        }
        if (next.status === "error") {
          setPhase("error")
          setError(next.error || "Произошла ошибка выгрузки, повторите еще раз")
        }
      } catch {
        if (!active) return
        setPhase("error")
        setError("Произошла ошибка выгрузки, повторите еще раз")
      } finally {
        loading = false
      }
    }

    poll()
    const intervalId = window.setInterval(poll, 700)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [job?.id, phase])

  const resetResult = () => {
    if (phase === "done" || phase === "error") {
      setPhase("idle")
      setJob(null)
      setError(null)
    }
  }

  const handleStatusChange = (status: TaskStatus) => {
    resetResult()
    setSelectedStatuses((prev) => toggleValue(prev, status))
  }

  const handleFieldChange = (field: TaskExportField) => {
    resetResult()
    setSelectedFields((prev) => toggleValue(prev, field))
  }

  const handleStartExport = async () => {
    if (!canStart) return

    try {
      setPhase("running")
      setError(null)
      setJob({ id: "", status: "queued", progress: 0, fileName: null, downloadUrl: null, error: null })
      const started = await startTaskExport({
        statuses: selectedStatuses,
        fields: selectedFields,
      })
      setJob(started)
    } catch {
      setPhase("error")
      setError("Произошла ошибка выгрузки, повторите еще раз")
    }
  }

  const handleDownload = async () => {
    if (!job?.id || phase !== "done") return

    try {
      setIsDownloading(true)
      const { blob, fileName } = await downloadTaskExport(job.id, job.fileName)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setPhase("error")
      setError("Произошла ошибка выгрузки, повторите еще раз")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Выгрузка задач в Excel
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="text-sm font-semibold">Статус</h3>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    resetResult()
                    setSelectedStatuses(EXPORT_STATUSES)
                  }}
                >
                  Все
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    resetResult()
                    setSelectedStatuses([])
                  }}
                >
                  Снять
                </Button>
              </div>
            </div>
            <div className="grid gap-1 p-3">
              {EXPORT_STATUSES.map((status) => (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/45"
                >
                  <Checkbox
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => handleStatusChange(status)}
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  <span className="min-w-0 flex-1 truncate">{status}</span>
                  <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                    {statusCounts[status] || 0}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="text-sm font-semibold">Поля</h3>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    resetResult()
                    setSelectedFields(EXPORT_FIELDS.map((field) => field.key))
                  }}
                >
                  Все
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    resetResult()
                    setSelectedFields([])
                  }}
                >
                  Снять
                </Button>
              </div>
            </div>
            <div className="grid gap-1 p-3 sm:grid-cols-2">
              {EXPORT_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/45"
                >
                  <Checkbox
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => handleFieldChange(field.key)}
                  />
                  <span className="min-w-0 truncate">{field.label}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {phase !== "idle" ? (
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {phase === "error" ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : phase === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                )}
                <span>
                  {phase === "done"
                    ? "Файл готов"
                    : phase === "error"
                      ? "Ошибка выгрузки"
                      : "Формирование файла"}
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
            {error ? <div className="mt-2 text-sm text-destructive">{error}</div> : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          {phase === "done" ? (
            <Button type="button" onClick={handleDownload} disabled={isDownloading}>
              <Download className="h-4 w-4" />
              Скачать
            </Button>
          ) : (
            <Button type="button" onClick={handleStartExport} disabled={!canStart}>
              <FileSpreadsheet className="h-4 w-4" />
              Выгрузить
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
