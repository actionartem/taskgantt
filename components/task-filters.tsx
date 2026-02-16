"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TaskPriority, TaskStatus } from "@/lib/types"
import { useApp } from "@/contexts/app-context"

interface TaskFiltersProps {
  search: string
  status: TaskStatus | "Все"
  assigneeId: string // "Все" или строковый id
  tag: string
  priority: TaskPriority | "Все"
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskStatus | "Все") => void
  onAssigneeChange: (value: string) => void // сюда прилетает "Все" или id
  onTagChange: (value: string) => void
  onPriorityChange: (value: TaskPriority | "Все") => void
}

const STATUSES: Array<TaskStatus | "Все"> = [
  "Все",
  "не в работе",
  "в аналитике",
  "на согласовании",
  "оценка",
  "готова к разработке",
  "разработка",
  "ревью",
  "завершена",
]

const PRIORITIES: TaskPriority[] = ["низкий", "средний", "высокий"]

export function TaskFilters({
  search,
  status,
  assigneeId,
  tag,
  priority,
  onSearchChange,
  onStatusChange,
  onAssigneeChange,
  onTagChange,
  onPriorityChange,
}: TaskFiltersProps) {
  const { settings } = useApp()

  return (
    <div className="space-y-3 border-b border-border/60 bg-background/35 p-4 backdrop-blur">
      <Input
        placeholder="Поиск по названию или ID..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full"
      />

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">Статус</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={assigneeId} onValueChange={onAssigneeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Исполнитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Все">Все</SelectItem>
              {settings.executors.map((exec) => (
                <SelectItem key={exec.id} value={String(exec.id)}>
                  {exec.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">Исполнитель</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={tag} onValueChange={onTagChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Тег" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Все">Все</SelectItem>
              {settings.tags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">Тег</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={priority} onValueChange={onPriorityChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Приоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Все">Все</SelectItem>
              {PRIORITIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">Приоритет</span>
        </div>
      </div>
    </div>
  )
}
