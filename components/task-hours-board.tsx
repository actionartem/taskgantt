"use client"

import { useMemo } from "react"
import type React from "react"
import { Clock3, ExternalLink, Pencil, TimerReset, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useApp } from "@/contexts/app-context"
import type { Task, TaskStatus } from "@/lib/types"
import { STATUS_COLORS } from "@/lib/types"

interface TaskHoursBoardProps {
  canEdit?: boolean
  onEditTask: (task: Task) => void
}

const ANALYTICS_STATUSES = new Set<TaskStatus>([
  "не в работе",
  "в аналитике",
  "на согласовании",
  "ревью",
  "оценка",
])

const DEVELOPMENT_STATUSES = new Set<TaskStatus>(["готова к разработке", "разработка"])
const DONE_STATUS: TaskStatus = "завершена"

const HOURS_FORMATTER = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
})

function getHours(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatHours(value: number | null) {
  return value == null ? "—" : `${HOURS_FORMATTER.format(value)} ч`
}

function getDelta(task: Task) {
  const approved = getHours(task.approvedHours)
  const spent = getHours(task.spentHours)
  if (approved == null || spent == null) return null
  return spent - approved
}

function getAssignee(task: Task, settings: ReturnType<typeof useApp>["settings"]) {
  if (task.assigneeName?.trim()) return task.assigneeName
  if (task.assigneeId != null) {
    const match = settings.executors.find((executor) => String(executor.id) === String(task.assigneeId))
    if (match?.name) return match.name
  }
  return null
}

function compareByApprovedHoursDesc(a: Task, b: Task) {
  const left = getHours(a.approvedHours) ?? -1
  const right = getHours(b.approvedHours) ?? -1
  if (left !== right) return right - left
  return a.id - b.id
}

function compareCompletedByDeltaDesc(a: Task, b: Task) {
  const left = getDelta(a)
  const right = getDelta(b)

  if (left != null && right != null && left !== right) return right - left
  if (left != null && right == null) return -1
  if (left == null && right != null) return 1
  return a.id - b.id
}

function TaskCard({
  task,
  variant,
  maxApprovedHours = 0,
  canEdit = true,
  onEditTask,
}: {
  task: Task
  variant: "analytics" | "development" | "done"
  maxApprovedHours?: number
  canEdit?: boolean
  onEditTask: (task: Task) => void
}) {
  const { settings } = useApp()
  const assignee = getAssignee(task, settings)
  const approvedHours = getHours(task.approvedHours)
  const spentHours = getHours(task.spentHours)
  const approvedPercent =
    approvedHours != null && maxApprovedHours > 0
      ? Math.max(6, Math.min(100, (approvedHours / maxApprovedHours) * 100))
      : 0

  return (
    <article className="rounded-md border bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-mono text-muted-foreground">#{task.id}</div>
          {task.link ? (
            <a
              href={task.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex max-w-full items-center gap-1 text-sm font-medium hover:underline"
            >
              <span className="truncate">{task.title}</span>
              <ExternalLink className="h-3.5 w-3.5 flex-none" />
            </a>
          ) : (
            <div className="mt-0.5 truncate text-sm font-medium">{task.title}</div>
          )}
        </div>

        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-none"
            onClick={() => onEditTask(task)}
            title="Редактировать"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge
          className="cursor-default select-none"
          style={{ backgroundColor: STATUS_COLORS[task.status], color: "white" }}
        >
          {task.status}
        </Badge>
        {assignee ? (
          <span className="inline-flex min-w-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 flex-none" />
            <span className="truncate">{assignee}</span>
          </span>
        ) : null}
      </div>

      {variant === "development" ? (
        <div className="mt-3 rounded-md border bg-muted/30 p-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Согласовано
            </span>
            <span className="font-semibold">{formatHours(approvedHours)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-teal-500"
              style={{ width: `${approvedPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {variant === "done" ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Согласовано
            </div>
            <div className="mt-1 font-semibold">{formatHours(approvedHours)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TimerReset className="h-3.5 w-3.5" />
              Затрачено
            </div>
            <div className="mt-1 font-semibold">{formatHours(spentHours)}</div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function TaskColumn({
  title,
  tasks,
  children,
}: {
  title: string
  tasks: Task[]
  children: React.ReactNode
}) {
  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-md border bg-card">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <div className="flex h-full min-h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Задач нет
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

export function TaskHoursBoard({ canEdit = true, onEditTask }: TaskHoursBoardProps) {
  const { tasks } = useApp()

  const { analyticsTasks, developmentTasks, doneTasks, maxDevelopmentApprovedHours } = useMemo(() => {
    const analytics = tasks
      .filter((task) => ANALYTICS_STATUSES.has(task.status))
      .sort((a, b) => a.id - b.id)

    const development = tasks
      .filter((task) => DEVELOPMENT_STATUSES.has(task.status))
      .sort((a, b) => {
        const statusRankA = a.status === "разработка" ? 0 : 1
        const statusRankB = b.status === "разработка" ? 0 : 1
        if (statusRankA !== statusRankB) return statusRankA - statusRankB
        return compareByApprovedHoursDesc(a, b)
      })

    const done = tasks
      .filter((task) => task.status === DONE_STATUS)
      .sort(compareCompletedByDeltaDesc)

    const maxApproved = development.reduce((max, task) => {
      const hours = getHours(task.approvedHours)
      return hours == null ? max : Math.max(max, hours)
    }, 0)

    return {
      analyticsTasks: analytics,
      developmentTasks: development,
      doneTasks: done,
      maxDevelopmentApprovedHours: maxApproved,
    }
  }, [tasks])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Сводка по задачам</h2>
        <span className="text-xs text-muted-foreground">{tasks.length} всего</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TaskColumn title="Аналитика" tasks={analyticsTasks}>
          {analyticsTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="analytics"
              canEdit={canEdit}
              onEditTask={onEditTask}
            />
          ))}
        </TaskColumn>

        <TaskColumn title="Разработка" tasks={developmentTasks}>
          {developmentTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="development"
              maxApprovedHours={maxDevelopmentApprovedHours}
              canEdit={canEdit}
              onEditTask={onEditTask}
            />
          ))}
        </TaskColumn>

        <TaskColumn title="Завершены" tasks={doneTasks}>
          {doneTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="done"
              canEdit={canEdit}
              onEditTask={onEditTask}
            />
          ))}
        </TaskColumn>
      </div>
    </section>
  )
}
