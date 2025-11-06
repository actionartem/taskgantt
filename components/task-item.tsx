"use client"

import { useState } from "react"
import { Pencil, Trash2, EyeOff, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const [open, setOpen] = useState(false)

  const handleStatusChange = (next: TaskStatus) => {
    const statusLog = addStatusChange(task, next)
    updateTask(task.id, { status: next, statusLog })
    setOpen(false)
  }

  const handleHideFromGantt = () => {
    updateTask(task.id, { hiddenFromGantt: !task.hiddenFromGantt })
  }

  return (
    <div className="flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors">
      {/* ID */}
      <div className="flex-shrink-0 w-16 text-sm font-mono text-muted-foreground">
        {task.id}
      </div>

      {/* Title / Link */}
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

      {/* Right controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Селект статуса: ещё тоньше по вертикали + стабильные клики */}
        <Select
          open={open}
          onOpenChange={setOpen}
          value={task.status}
          onValueChange={(v) => handleStatusChange(v as TaskStatus)}
        >
          <SelectTrigger
            // ещё уже: высота 20px, компактные отступы и шрифт
            className="h-5 min-h-0 px-1.5 py-0 text-[11px] leading-none rounded-md border-0 shadow-none w-auto min-w-0 whitespace-nowrap"
            style={{ backgroundColor: STATUS_COLORS[task.status], color: "white" }}
          >
            <SelectValue />
          </SelectTrigger>

          {/* popper + высокий z-index, чтобы меню было кликабельным над всем */}
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            className="z-[60] min-w-[12rem]"
          >
            {STATUSES.map((s) => (
              <SelectItem
                key={s}
                value={s}
                // На некоторых раскладках Radix может не триггерить выбор из-за оверлеев.
                // Принудительно применяем статус через onSelect — клики всегда срабатывают.
                onSelect={(e) => {
                  e.preventDefault()
                  handleStatusChange(s)
                }}
                className="text-[12px] h-7 py-0 leading-6"
              >
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Имя исполнителя */}
        {task.assigneeName && (
          <span className="text-xs text-muted-foreground">👤 {task.assigneeName}</span>
        )}

        {/* Индикатор приоритета */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          title={`Приоритет: ${task.priority}`}
        />

        {/* Edit */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        {/* Hide from Gantt */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleHideFromGantt}>
          <EyeOff className={`h-3.5 w-3.5 ${task.hiddenFromGantt ? "text-muted-foreground" : ""}`} />
        </Button>

        {/* Delete */}
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
