"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  Flag,
  History,
  LineChart,
  Search,
} from "lucide-react"

import type { Task, TaskHistoryEntry, TaskStatus } from "@/lib/types"
import { STATUS_COLORS, normalizeStatusLabel } from "@/lib/types"
import { getTaskHistory } from "@/lib/api"
import { useApp } from "@/contexts/app-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
type SortKey = "id" | "status" | "priority" | "startDate" | "endDate" | "assignee"

const SORT_LABELS: Record<SortKey, string> = {
  id: "ID",
  status: "Статус",
  priority: "Приоритет",
  startDate: "Старт",
  endDate: "Финиш",
  assignee: "Исполнитель",
}

const PRIORITY_ORDER = ["низкий", "средний", "высокий"]
const STATUS_ORDER: TaskStatus[] = [
  "не в работе",
  "в аналитике",
  "на согласовании",
  "оценка",
  "готова к разработке",
  "разработка",
  "ревью",
  "завершена",
]

const formatDateTime = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(date)
}

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start) return "—"
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : new Date()
  const ms = endDate.getTime() - startDate.getTime()
  if (!Number.isFinite(ms) || ms < 0) return "—"
  return formatDurationMs(ms)
}

const formatDurationMs = (ms: number) => {
  if (!Number.isFinite(ms) || ms < 0) return "—"
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  const parts = []
  if (days) parts.push(`${days}д`)
  if (hours) parts.push(`${hours}ч`)
  if (!days && minutes) parts.push(`${minutes}м`)
  return parts.join(" ") || "0м"
}

const getDurationMs = (start?: string | null, end?: string | null) => {
  if (!start) return 0
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : new Date()
  const ms = endDate.getTime() - startDate.getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return ms
}

const getStatusColor = (value?: string | null) => {
  const label = normalizeStatusLabel(value)
  if (Object.prototype.hasOwnProperty.call(STATUS_COLORS, label)) {
    return STATUS_COLORS[label as TaskStatus]
  }
  return "#94A3B8"
}

const buildStatusTimeline = (entries: TaskHistoryEntry[]) => {
  const statusEntries = entries
    .filter((entry) => entry.field_name === "status")
    .slice()
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())

  return statusEntries.map((entry, index) => {
    const nextEntry = statusEntries[index + 1]
    return {
      start: entry.changed_at,
      end: nextEntry?.changed_at ?? null,
      from: entry.old_value,
      to: entry.new_value,
    }
  })
}

const buildDateChanges = (entries: TaskHistoryEntry[]) => {
  return entries
    .filter((entry) => entry.field_name === "start_at" || entry.field_name === "due_at")
    .slice()
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
}

export function TaskHistorySection() {
  const { tasks, settings } = useApp()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortAsc, setSortAsc] = useState(true)
  const [visibleCount, setVisibleCount] = useState(10)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [historyEntries, setHistoryEntries] = useState<TaskHistoryEntry[]>([])
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  )
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (!query) return true
      return (
        task.title.toLowerCase().includes(query) ||
        task.id.toString().includes(query)
      )
    })
  }, [tasks, search])

  const sortedTasks = useMemo(() => {
    const next = [...filteredTasks]
    next.sort((a, b) => {
      const direction = sortAsc ? 1 : -1
      switch (sortKey) {
        case "id":
          return (a.id - b.id) * direction
        case "status":
          return (
            (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) *
            direction
          )
        case "priority":
          return (
            (PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)) *
            direction
          )
        case "startDate":
          return (
            (new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime()) *
            direction
          )
        case "endDate":
          return (
            (new Date(a.endDate ?? 0).getTime() - new Date(b.endDate ?? 0).getTime()) *
            direction
          )
        case "assignee": {
          const aName =
            a.assigneeName ??
            settings.executors.find((e) => String(e.id) === String(a.assigneeId))?.name ??
            ""
          const bName =
            b.assigneeName ??
            settings.executors.find((e) => String(e.id) === String(b.assigneeId))?.name ??
            ""
          return aName.localeCompare(bName) * direction
        }
        default:
          return 0
      }
    })
    return next
  }, [filteredTasks, sortAsc, sortKey, settings.executors])

  const visibleTasks = sortedTasks.slice(0, visibleCount)
  const hasMore = visibleCount < sortedTasks.length

  const selectedTimeline = selectedTask ? buildStatusTimeline(historyEntries) : []
  const dateChanges = selectedTask ? buildDateChanges(historyEntries) : []
  const dateChangesChron = useMemo(() => {
    return [...dateChanges].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    )
  }, [dateChanges])

  const statusTotals = useMemo(() => {
    const totals = new Map<string, number>()
    selectedTimeline.forEach((item) => {
      const label = normalizeStatusLabel(item.to)
      totals.set(label, (totals.get(label) ?? 0) + getDurationMs(item.start, item.end))
    })
    return totals
  }, [selectedTimeline])

  const totalStatusMs = useMemo(() => {
    let total = 0
    statusTotals.forEach((value) => {
      total += value
    })
    return total
  }, [statusTotals])

  const longestStatus = useMemo(() => {
    let maxLabel = "—"
    let maxValue = 0
    statusTotals.forEach((value, label) => {
      if (value > maxValue) {
        maxValue = value
        maxLabel = label
      }
    })
    return { label: maxLabel, duration: maxValue }
  }, [statusTotals])

  const statusChangesCount = useMemo(
    () => historyEntries.filter((entry) => entry.field_name === "status").length,
    [historyEntries],
  )

  const statusSegments = selectedTimeline.map((segment, index) => {
    const durationMs = getDurationMs(segment.start, segment.end)
    const percent = totalStatusMs ? Math.max(3, (durationMs / totalStatusMs) * 100) : 0
    return {
      id: `status-${index}-${segment.start}`,
      label: normalizeStatusLabel(segment.to),
      start: segment.start,
      end: segment.end,
      durationMs,
      percent,
      color: getStatusColor(segment.to),
      from: segment.from,
      to: segment.to,
    }
  })

  const analyticsEvents = useMemo(() => {
    const statusEvents = statusSegments.map((segment) => ({
      id: segment.id,
      type: "status" as const,
      date: segment.start,
      title: `Статус: ${segment.label}`,
      subtitle: `${formatDateTime(segment.start)} → ${segment.end ? formatDateTime(segment.end) : "сейчас"}`,
      detail: `Переход: ${normalizeStatusLabel(segment.from)} → ${normalizeStatusLabel(segment.to)}`,
      duration: formatDurationMs(segment.durationMs),
    }))
    const dateEvents = dateChangesChron.map((entry, index) => ({
      id: `date-${entry.changed_at}-${index}`,
      type: "date" as const,
      date: entry.changed_at,
      title: entry.field_name === "start_at" ? "Изменение старта" : "Изменение финиша",
      subtitle: formatDateTime(entry.changed_at),
      detail: `${formatDate(entry.old_value)} → ${formatDate(entry.new_value)}`,
      duration: "—",
    }))
    return [...statusEvents, ...dateEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }, [dateChangesChron, statusSegments])

  useEffect(() => {
    if (!selectedTask) {
      setHistoryEntries([])
      setHistoryStatus("idle")
      setHistoryError(null)
      setAnalyticsOpen(false)
      return
    }

    let active = true
    setHistoryStatus("loading")
    setHistoryError(null)
    getTaskHistory(selectedTask.id)
      .then((data) => {
        if (!active) return
        setHistoryEntries(Array.isArray(data) ? data : [])
        setHistoryStatus("ready")
      })
      .catch((error: Error) => {
        if (!active) return
        setHistoryEntries([])
        setHistoryStatus("error")
        setHistoryError(error.message || "Не удалось загрузить историю")
      })

    return () => {
      active = false
    }
  }, [selectedTask?.id])

  useEffect(() => {
    if (!analyticsOpen) return
    if (analyticsEvents.length > 0) {
      setSelectedEventId(analyticsEvents[0].id)
    } else {
      setSelectedEventId(null)
    }
  }, [analyticsEvents, analyticsOpen])

  const selectedEvent = analyticsEvents.find((event) => event.id === selectedEventId)

  return (
    <Card className="flex h-full min-h-[240px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold">Все задачи и история</h2>
          <p className="text-sm text-muted-foreground">
            Быстрый обзор, сортировка и история изменений статусов.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию или ID"
              className="pl-9 w-56"
            />
          </div>
          <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortAsc((prev) => !prev)}
            title={sortAsc ? "Сортировка по возрастанию" : "Сортировка по убыванию"}
          >
            {sortAsc ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col border-r">
          <ScrollArea className="flex-1 min-h-0" type="always">
            <div className="divide-y">
              {visibleTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTask(task)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/60"
                >
                  <div className="w-16 text-sm font-mono text-muted-foreground">#{task.id}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{task.title}</span>
                      <Badge
                        style={{ backgroundColor: STATUS_COLORS[task.status], color: "white" }}
                        className="text-[11px]"
                      >
                        {task.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {task.assigneeName ||
                        settings.executors.find((e) => String(e.id) === String(task.assigneeId))
                          ?.name ||
                        "Без исполнителя"}
                      {" · "}
                      {task.priority}
                      {" · "}
                      старт {task.startDate || "—"}
                      {" · "}
                      финиш {task.endDate || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <History className="h-4 w-4" />
                    {task.statusLog?.length || 0}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Показано {visibleTasks.length} из {sortedTasks.length}
            </span>
            {hasMore ? (
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((prev) => prev + 10)}>
                Показать еще
              </Button>
            ) : sortedTasks.length > 10 ? (
              <Button variant="ghost" size="sm" onClick={() => setVisibleCount(10)}>
                Свернуть
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="border-b p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground">История изменений</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnalyticsOpen(true)}
                disabled={!selectedTask || historyStatus !== "ready" || historyEntries.length === 0}
              >
                <LineChart className="mr-2 h-4 w-4" />
                Аналитика / Таймлайн
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0" type="always">
            <div className="flex flex-1 flex-col gap-4 px-4 py-6">
              {selectedTask ? (
                <>
                  <div>
                    <div className="text-lg font-semibold">{selectedTask.title}</div>
                    <div className="text-sm text-muted-foreground">
                      Задача #{selectedTask.id} · {selectedTask.priority} ·{" "}
                      {selectedTask.assigneeName ||
                        settings.executors.find((e) => String(e.id) === String(selectedTask.assigneeId))
                          ?.name ||
                        "Без исполнителя"}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Здесь собрана история смены статусов и дат. Видно, когда менялась задача и
                    сколько времени она находилась в каждом статусе.
                  </div>

                  <div className="grid gap-3 rounded-lg border bg-muted/10 p-4 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Текущий статус</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: getStatusColor(selectedTask.status) }}
                        />
                        {normalizeStatusLabel(selectedTask.status)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Старт</div>
                      <div className="mt-1 text-sm font-medium">
                        {selectedTask.startDate || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Финиш</div>
                      <div className="mt-1 text-sm font-medium">
                        {selectedTask.endDate || "—"}
                      </div>
                    </div>
                  </div>

                  {historyStatus === "loading" ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Загружаем историю изменений…
                    </div>
                  ) : historyStatus === "error" ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                      Не удалось загрузить историю. {historyError}
                    </div>
                  ) : historyEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      История пока пустая. Первые записи появятся после изменения статуса или дат.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Изменения статуса
                        </h4>
                        {selectedTimeline.length === 0 ? (
                          <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Нет записей по статусам.
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {selectedTimeline.map((item, index) => (
                              <div key={`${item.start}-${index}`} className="rounded-lg border p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: getStatusColor(item.to) }}
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      {normalizeStatusLabel(item.to)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatDateTime(item.start)} →{" "}
                                      {item.end ? formatDateTime(item.end) : "сейчас"}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    {formatDuration(item.start, item.end)}
                                  </Badge>
                                </div>
                                <div className="mt-3 text-xs text-muted-foreground">
                                  Переход: {normalizeStatusLabel(item.from)} →{" "}
                                  {normalizeStatusLabel(item.to)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Изменения сроков
                        </h4>
                        {dateChanges.length === 0 ? (
                          <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Нет изменений по датам.
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {dateChanges.map((entry, index) => (
                              <div key={`${entry.changed_at}-${index}`} className="rounded-lg border p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                  {entry.field_name === "start_at" ? (
                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Flag className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      {entry.field_name === "start_at"
                                        ? "Старт задачи"
                                        : "Финиш задачи"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatDate(entry.old_value)} → {formatDate(entry.new_value)}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {formatDateTime(entry.changed_at)}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Выберите задачу слева, чтобы увидеть историю статусов.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[95vw] h-[92vh] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              Визуализация истории задачи
            </DialogTitle>
          </DialogHeader>
          {!selectedTask ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Выберите задачу, чтобы увидеть аналитику.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-gradient-to-r from-slate-50 to-white p-4">
                <div>
                  <div className="text-sm text-muted-foreground">Задача #{selectedTask.id}</div>
                  <div className="text-lg font-semibold">{selectedTask.title}</div>
                </div>
              </div>

              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
                  <TabsTrigger value="timeline">Таймлайн</TabsTrigger>
                  <TabsTrigger value="dates">Сроки</TabsTrigger>
                  <TabsTrigger value="statuses">Статусы</TabsTrigger>
                  <TabsTrigger value="metrics">Метрики</TabsTrigger>
                  <TabsTrigger value="events">События</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-6 space-y-6">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                      <div className="text-xs uppercase text-muted-foreground">
                        Время в статусах
                      </div>
                      <div className="mt-2 text-xl font-semibold">
                        {formatDurationMs(totalStatusMs)}
                      </div>
                      <div className="text-xs text-muted-foreground">учтено до «сейчас»</div>
                    </div>
                    <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                      <div className="text-xs uppercase text-muted-foreground">Самый долгий</div>
                      <div className="mt-2 text-xl font-semibold">{longestStatus.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDurationMs(longestStatus.duration)}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                      <div className="text-xs uppercase text-muted-foreground">Изменений</div>
                      <div className="mt-2 text-xl font-semibold">
                        {statusChangesCount + dateChanges.length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        статусы: {statusChangesCount}, сроки: {dateChanges.length}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-6 rounded-xl border bg-white/70 p-5">
                      <div>
                        <div className="text-sm font-semibold">Таймлайн статусов</div>
                        {statusSegments.length === 0 ? (
                          <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Нет данных по статусам.
                          </div>
                        ) : (
                          <>
                            <div className="mt-4 flex h-10 w-full overflow-hidden rounded-full border bg-muted/30">
                              {statusSegments.map((segment) => (
                                <button
                                  key={segment.id}
                                  type="button"
                                  className="h-full transition hover:opacity-90"
                                  style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
                                  onClick={() => setSelectedEventId(segment.id)}
                                  title={`${segment.label} • ${formatDurationMs(segment.durationMs)}`}
                                />
                              ))}
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              {statusSegments.map((segment) => (
                                <button
                                  key={`${segment.id}-label`}
                                  type="button"
                                  onClick={() => setSelectedEventId(segment.id)}
                                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition hover:bg-muted/40"
                                >
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: segment.color }}
                                    />
                                    {segment.label}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatDurationMs(segment.durationMs)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-semibold">Линия изменений сроков</div>
                        {dateChangesChron.length === 0 ? (
                          <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Нет изменений по срокам.
                          </div>
                        ) : (
                          <div className="mt-4">
                            <div className="relative h-16">
                              <div className="absolute left-0 right-0 top-8 h-px bg-border" />
                              <div className="relative flex h-full items-center justify-between gap-4">
                                {dateChangesChron.map((entry, index) => {
                                  const id = `date-${entry.changed_at}-${index}`
                                  const isStart = entry.field_name === "start_at"
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      onClick={() => setSelectedEventId(id)}
                                      className="flex min-w-[80px] flex-col items-center gap-2 text-xs text-muted-foreground"
                                    >
                                      <span
                                        className={`h-3 w-3 rounded-full border-2 ${
                                          isStart
                                            ? "border-blue-500 bg-blue-200"
                                            : "border-emerald-500 bg-emerald-200"
                                        }`}
                                      />
                                      <span>{isStart ? "Старт" : "Финиш"}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-white/80 p-5">
                      <div className="text-sm font-semibold">Детали события</div>
                      {selectedEvent ? (
                        <div className="mt-4 space-y-4 text-sm">
                          <div className="text-base font-semibold">{selectedEvent.title}</div>
                          <div className="text-xs text-muted-foreground">{selectedEvent.subtitle}</div>
                          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                            {selectedEvent.detail}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Длительность:{" "}
                            <span className="font-medium text-foreground">
                              {selectedEvent.duration}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Выберите сегмент или событие, чтобы увидеть детали.
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="dates" className="mt-6">
                  {dateChangesChron.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Изменений по срокам пока нет.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {dateChangesChron.map((entry, index) => (
                        <div
                          key={`${entry.changed_at}-${index}`}
                          className="rounded-xl border bg-white/80 p-4 shadow-sm"
                        >
                          <div className="text-sm font-semibold">
                            {entry.field_name === "start_at" ? "Старт задачи" : "Финиш задачи"}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {formatDate(entry.old_value)} → {formatDate(entry.new_value)}
                          </div>
                          <div className="mt-3 inline-flex items-center rounded-full border px-2 py-1 text-xs">
                            {formatDateTime(entry.changed_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="statuses" className="mt-6">
                  {statusSegments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Нет данных по статусам.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {statusSegments.map((segment) => (
                        <div
                          key={`${segment.id}-card`}
                          className="rounded-xl border bg-white/80 p-4 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: segment.color }}
                            />
                            <div className="text-sm font-semibold">{segment.label}</div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {formatDateTime(segment.start)} →{" "}
                            {segment.end ? formatDateTime(segment.end) : "сейчас"}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {normalizeStatusLabel(segment.from)} →{" "}
                              {normalizeStatusLabel(segment.to)}
                            </span>
                            <span className="font-medium">{formatDurationMs(segment.durationMs)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="metrics" className="mt-6 space-y-6">
                  <div className="rounded-xl border bg-white/80 p-5 shadow-sm">
                    <div className="text-sm font-semibold">Распределение времени по статусам</div>
                    <div className="mt-4 space-y-3">
                      {Array.from(statusTotals.entries()).map(([label, value]) => {
                        const percent = totalStatusMs ? (value / totalStatusMs) * 100 : 0
                        return (
                          <div key={label}>
                            <div className="flex items-center justify-between text-xs">
                              <span>{label}</span>
                              <span className="text-muted-foreground">
                                {Math.round(percent)}%
                              </span>
                            </div>
                            <div className="mt-1 h-2 w-full rounded-full bg-muted/40">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="events" className="mt-6">
                  {historyEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      История событий пуста.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyEntries
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.changed_at).getTime() -
                            new Date(a.changed_at).getTime(),
                        )
                        .map((entry, index) => (
                          <div
                            key={`${entry.changed_at}-${index}`}
                            className="rounded-xl border bg-white/80 p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-semibold">
                                {entry.field_name === "status"
                                  ? "Статус"
                                  : entry.field_name === "start_at"
                                    ? "Старт"
                                    : "Финиш"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(entry.changed_at)}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {entry.field_name === "status"
                                ? `${normalizeStatusLabel(entry.old_value)} → ${normalizeStatusLabel(entry.new_value)}`
                                : `${formatDate(entry.old_value)} → ${formatDate(entry.new_value)}`}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
