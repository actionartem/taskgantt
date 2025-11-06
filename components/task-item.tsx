'use client'

import { useMemo, useState } from 'react'
import { Pencil, Trash2, EyeOff, ExternalLink, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Task, TaskStatus } from '@/lib/types'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/types'
import { useApp } from '@/contexts/app-context'
import { addStatusChange } from '@/lib/task-utils'

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
}

const STATUSES: TaskStatus[] = [
  'не в работе',
  'в аналитике',
  'на согласовании',
  'оценка',
  'готова к разработке',
  'разработка',
  'завершена',
]

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const { updateTask, deleteTask, settings } = useApp()
  const [open, setOpen] = useState(false)

  const handleStatusChange = (newStatus: TaskStatus) => {
    const statusLog = addStatusChange(task, newStatus)
    updateTask(task.id, { status: newStatus, statusLog })
    setOpen(false)
  }

  const handleHideFromGantt = () => {
    updateTask(task.id, { hiddenFromGantt: !task.hiddenFromGantt })
  }

  const assigneeDisplay = useMemo(() => {
    if (task.assigneeName && task.assigneeName.trim()) return task.assigneeName
    if (task.assigneeId != null) {
      const match = settings.executors.find((e) => String(e.id) === String(task.assigneeId))
      if (match?.name) return match.name
    }
    if (typeof (task as any).assignee === 'string' && (task as any).assignee.trim()) {
      return (task as any).assignee as string
    }
    return ''
  }, [task.assigneeName, task.assigneeId, (task as any).assignee, settings.executors])

  return (
    <div className="flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 w-16 text-sm font-mono text-muted-foreground">{task.id}</div>

      <div className="flex-1 min-w-0">
        {task.link ? (
          <a
            href={task.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline inline-flex items-center gap-1"
          >
            {task.title}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <div className="text-sm font-medium">{task.title}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {open ? (
          <Select value={task.status} onValueChange={handleStatusChange} open={open} onOpenChange={setOpen}>
            <SelectTrigger className="w-40 h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge
            style={{ backgroundColor: STATUS_COLORS[task.status], color: 'white' }}
            className="cursor-pointer hover:opacity-80"
            onClick={() => setOpen(true)}
          >
            {task.status}
          </Badge>
        )}

        {assigneeDisplay ? (
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            {assigneeDisplay}
          </span>
        ) : null}

        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          title={`Приоритет: ${task.priority}`}
        />

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleHideFromGantt}>
          <EyeOff className={`h-3.5 w-3.5 ${task.hiddenFromGantt ? 'text-muted-foreground' : ''}`} />
        </Button>

        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTask(task.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
