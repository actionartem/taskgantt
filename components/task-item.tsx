"use client"

import { useState } from "react"
import { Pencil, Trash2, EyeOff, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Task, TaskStatus } from "@/lib/types"
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { addStatusChange } from "@/lib/task-utils"

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
}

const STATUSES: TaskStatus[] = [
  "не в работе",
  "в аналитике",
  "на согласовании",
  "оценка",
  "готова к разработке",
  "разработка",
  "завершена",
]

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const { updateTask, deleteTask } = useApp()
  const [statusOpen, setStatusOpen] = useState(false)

  const handleStatusChange = (newStatus: TaskStatus) => {
    const statusLog = addStatusChange(task, newStatus)
    updateTask(task.id, { status: newStatus, statusLog })
    setStatusOpen(false)
  }

  const handleHideFromGantt = () => {
    updateTask(task.id, { hiddenFromGantt: !task.hiddenFromGantt })
  }

  return (
    <div className="flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 w-16 text-sm font-mono text-muted-foreground">
        {task.id}
      </div>

      <div className="flex-1 min-w-0">
        {task.link ? (
          <a
            href={task.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline inline-flex items-center gap-1"
          >
            {task.title}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <div className="text-sm font-medium">{task.title}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* СТАТУС — всегда рендерим Select; открытие/закрытие управляем */}
        <Select
          open={statusOpen}
          onOpenChange={setStatusOpen}
          value={task.status}
          onValueChange={(v) => handleStatusChange(v as TaskStatus)}
        >
          <SelectTrigger
            className="w-40 h-7 border-0 px-2 py-0 text-xs font-medium rounded-md"
            style={{ backgroundColor: STATUS_COLORS[task.status], color: "white" }}
          >
            <SelectValue />
          </SelectTrigger>

          {/* popper — чтобы список корректно кликался внутри скролла */}
          <SelectContent position="popper" side="bottom" align="start" className="min-w-[10rem]">
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Имя исполнителя (берётся из task.assigneeName в маппинге API→UI) */}
        {task.assigneeName && (
          <span className="text-xs text-muted-foreground">👤 {task.assigneeName}</span>
        )}

        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          title={`Приоритет: ${task.priority}`}
        />

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleHideFromGantt}>
          <EyeOff className={`h-3.5 w-3.5 ${task.hiddenFromGantt ? "text-muted-foreground" : ""}`} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => deleteTask(task.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
