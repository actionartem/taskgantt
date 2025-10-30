"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TaskStatus } from "@/lib/types"
import { useApp } from "@/contexts/app-context"

interface TaskFiltersProps {
  search: string
  status: TaskStatus | "Все"
  assignee: string
  tag: string
  dateRange: "all" | "thisMonth"
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskStatus | "Все") => void
  onAssigneeChange: (value: string) => void
  onTagChange: (value: string) => void
  onDateRangeChange: (value: "all" | "thisMonth") => void
}

const STATUSES: Array<TaskStatus | "Все"> = [
  "Все",
  "не в работе",
  "в аналитике",
  "на согласовании",
  "оценка",
  "готова к разработке",
  "разработка",
  "завершена",
]

export function TaskFilters({
  search,
  status,
  assignee,
  tag,
  dateRange,
  onSearchChange,
  onStatusChange,
  onAssigneeChange,
  onTagChange,
  onDateRangeChange,
}: TaskFiltersProps) {
  const { settings } = useApp()

  return (
    <div className="space-y-3 p-4 border-b bg-card">
      <Input
        placeholder="Поиск по названию или ID..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-40">
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
          <Select value={assignee} onValueChange={onAssigneeChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Исполнитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Все">Все</SelectItem>
              {settings.executors.map((exec) => (
                <SelectItem key={exec.id} value={exec.name}>
                  {exec.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">Исполнитель</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={tag} onValueChange={onTagChange}>
            <SelectTrigger className="w-40">
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
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="thisMonth">Этот месяц</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">Временной отрезок</span>
        </div>
      </div>
    </div>
  )
}
