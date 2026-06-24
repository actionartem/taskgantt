"use client"

import { memo, useMemo } from "react"
import type React from "react"
import { Clock3, ExternalLink, Pencil, TimerReset, User } from "lucide-react"

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

const TaskRow = memo(function TaskRow({
  task,
  variant,
  settings,
  canEdit = true,
  onEditTask,
}: {
  task: Task
  variant: "analytics" | "development" | "done"
  settings: ReturnType<typeof useApp>["settings"]
  canEdit?: boolean
  onEditTask: (task: Task) => void
}) {
  const assignee = getAssignee(task, settings)
  const approvedHours = getHours(task.approvedHours)
  const spentHours = getHours(task.spentHours)

  return (
    <article className="interactive-row group flex min-h-12 items-center gap-2 border-b bg-card/35 px-3 py-2 text-sm last:border-b-0 hover:bg-accent/35">
      <div className="w-14 flex-none font-mono text-xs text-muted-foreground">#{task.id}</div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {task.link ? (
            <a
              href={task.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1 font-medium hover:underline"
            >
              <span className="truncate">{task.title}</span>
              <ExternalLink className="h-3 w-3 flex-none" />
            </a>
          ) : (
            <div className="truncate font-medium">{task.title}</div>
          )}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1">
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ backgroundColor: STATUS_COLORS[task.status] }}
            />
            <span className="truncate">{task.status}</span>
          </span>
          {assignee ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <User className="h-3 w-3 flex-none" />
              <span className="truncate">{assignee}</span>
            </span>
          ) : null}
        </div>
      </div>

      {variant === "development" ? (
        <div className="w-24 flex-none text-right text-xs">
          <div className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock3 className="h-3 w-3" />
            Согл.
          </div>
          <div className="font-semibold">{formatHours(approvedHours)}</div>
        </div>
      ) : null}

      {variant === "done" ? (
        <div className="grid w-44 flex-none grid-cols-2 gap-2 text-right text-xs">
          <div>
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              Согл.
            </div>
            <div className="font-semibold">{formatHours(approvedHours)}</div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <TimerReset className="h-3 w-3" />
              Затр.
            </div>
            <div className="font-semibold">{formatHours(spentHours)}</div>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-none opacity-70 group-hover:opacity-100"
          onClick={() => onEditTask(task)}
          title="Редактировать"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </article>
  )
})

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
    <section className="workspace-panel flex min-h-[360px] flex-col overflow-hidden rounded-lg border">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-card/70 to-accent/35 px-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">
            Задач нет
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

export const TaskHoursBoard = memo(function TaskHoursBoard({ canEdit = true, onEditTask }: TaskHoursBoardProps) {
  const { tasks, settings } = useApp()

  const { analyticsTasks, developmentTasks, doneTasks } = useMemo(() => {
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

    return {
      analyticsTasks: analytics,
      developmentTasks: development,
      doneTasks: done,
    }
  }, [tasks])

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Сводка по задачам</h2>
        <span className="text-xs text-muted-foreground">{tasks.length} всего</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TaskColumn title="Аналитика" tasks={analyticsTasks}>
          {analyticsTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              variant="analytics"
              settings={settings}
              canEdit={canEdit}
              onEditTask={onEditTask}
            />
          ))}
        </TaskColumn>

        <TaskColumn title="Разработка" tasks={developmentTasks}>
          {developmentTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              variant="development"
              settings={settings}
              canEdit={canEdit}
              onEditTask={onEditTask}
            />
          ))}
        </TaskColumn>

        <TaskColumn title="Завершены" tasks={doneTasks}>
          {doneTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              variant="done"
              settings={settings}
              canEdit={canEdit}
              onEditTask={onEditTask}
            />
          ))}
        </TaskColumn>
      </div>
    </section>
  )
})
