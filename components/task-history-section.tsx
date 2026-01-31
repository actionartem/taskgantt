"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDownAZ, ArrowUpAZ, CalendarDays, Flag, History, Search } from "lucide-react"

import type { Task, TaskHistoryEntry, TaskStatus } from "@/lib/types"
import { STATUS_COLORS, normalizeStatusLabel } from "@/lib/types"
import { getTaskHistory } from "@/lib/api"
import { useApp } from "@/contexts/app-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

  useEffect(() => {
    if (!selectedTask) {
      setHistoryEntries([])
      setHistoryStatus("idle")
      setHistoryError(null)
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
            <h3 className="text-sm font-semibold text-muted-foreground">История изменений</h3>
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
    </Card>
  )
}
