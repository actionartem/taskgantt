"use client"

import { useMemo } from "react"
import { Pencil, Trash2, EyeOff, ExternalLink, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import type { Task } from "@/lib/types"
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/types"
import { useApp } from "@/contexts/app-context"

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
}

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const { updateTask, deleteTask, settings } = useApp()

  const handleHideFromGantt = () => {
    updateTask(task.id, { hiddenFromGantt: !task.hiddenFromGantt })
  }

  // Отображаемое имя исполнителя
  const assigneeDisplay = useMemo(() => {
    if (task.assigneeName && task.assigneeName.trim()) return task.assigneeName
    if (task.assigneeId != null) {
      const match = settings.executors.find((e) => String(e.id) === String(task.assigneeId))
      if (match?.name) return match.name
    }
    if (typeof (task as any).assignee === "string" && (task as any).assignee.trim()) {
      return (task as any).assignee as string
    }
    return ""
  }, [task.assigneeName, task.assigneeId, (task as any).assignee, settings.executors])

  return (
    <div className="interactive-lift group flex items-center gap-3 border-b border-border/50 p-3 hover:bg-muted/45">
      <div className="w-16 flex-shrink-0 rounded-md bg-muted/55 px-2 py-1 text-center text-xs font-mono text-muted-foreground">{task.id}</div>

      <div className="flex-1 min-w-0">
        {task.link ? (
          <a
            href={task.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            {task.title}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <div className="text-sm font-medium">{task.title}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Бейдж статуса — только отображение, кликов нет */}
        <Badge
          style={{ backgroundColor: STATUS_COLORS[task.status], color: "white" }}
          className="cursor-default select-none shadow-sm"
          title="Статус изменяется в режиме редактирования задачи"
          aria-disabled
        >
          {task.status}
        </Badge>

        {assigneeDisplay ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            {assigneeDisplay}
          </span>
        ) : null}

        <div
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-background"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          title={`Приоритет: ${task.priority}`}
        />

        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onEdit(task)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleHideFromGantt}>
          <EyeOff className={`h-3.5 w-3.5 ${task.hiddenFromGantt ? "text-primary" : "text-muted-foreground"}`} />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
              <AlertDialogDescription>
                Задача будет удалена из списка и из базы данных.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Нет</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTask(task.id)}>Да</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

