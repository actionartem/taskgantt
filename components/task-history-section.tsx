"use client"

import { useMemo, useState } from "react"
import { ArrowDownAZ, ArrowUpAZ, History, Search } from "lucide-react"

import type { Task, TaskStatus } from "@/lib/types"
import { STATUS_COLORS } from "@/lib/types"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

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

const buildTimeline = (task: Task) => {
  const logs = Array.isArray(task.statusLog) ? [...task.statusLog] : []
  logs.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())

  return logs.map((entry, index) => {
    const nextEntry = logs[index + 1]
    return {
      status: entry.newStatus,
      start: entry.datetime,
      end: nextEntry?.datetime ?? null,
      from: entry.oldStatus,
      to: entry.newStatus,
    }
  })
}

export function TaskHistorySection() {
  const { tasks, settings } = useApp()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortAsc, setSortAsc] = useState(true)
  const [visibleCount, setVisibleCount] = useState(8)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

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

  const selectedTimeline = selectedTask ? buildTimeline(selectedTask) : []

  return (
    <>
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

        <ScrollArea className="flex-1">
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
            <Button variant="outline" size="sm" onClick={() => setVisibleCount((prev) => prev + 8)}>
              Показать еще
            </Button>
          ) : sortedTasks.length > 8 ? (
            <Button variant="ghost" size="sm" onClick={() => setVisibleCount(8)}>
              Свернуть
            </Button>
          ) : null}
        </div>
      </Card>

      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent side="right" className="w-[480px] sm:max-w-md">
          {selectedTask && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="text-xl">{selectedTask.title}</SheetTitle>
                <SheetDescription>
                  Задача #{selectedTask.id} · {selectedTask.priority} ·{" "}
                  {selectedTask.assigneeName ||
                    settings.executors.find((e) => String(e.id) === String(selectedTask.assigneeId))
                      ?.name ||
                    "Без исполнителя"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Здесь собрана история смены статусов. Мы показываем продолжительность
                  каждого статуса, чтобы понять, где задача задерживается.
                </div>

                {selectedTimeline.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    История пока пустая. Первые записи появятся после изменения статуса.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTimeline.map((item, index) => (
                      <div key={`${item.start}-${index}`} className="rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[item.status] }}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{item.status}</div>
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
                          Переход: {item.from} → {item.to}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
