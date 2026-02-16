"use client"

import { Moon, SettingsIcon, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useApp } from "@/contexts/app-context"
import type { GroupBy, TaskStatus } from "@/lib/types"

interface HeaderProps {
  onOpenSettings: () => void
  onOpenAuth: () => void // используем и для входа, и для профиля
  user?: {
    id?: number
    name: string
    login: string
    role_text?: string
    telegram_id?: string | null // <-- добавлено, чтобы далее пробрасывать в модалку
  } | null
}

export function Header({ onOpenSettings, onOpenAuth, user }: HeaderProps) {
  const {
    tasks,
    theme,
    toggleTheme,
    groupBy,
    setGroupBy,
    selectedStatuses,
    toggleSelectedStatus,
  } = useApp()

  const statusOrder: { status: TaskStatus; label: string }[] = [
    { status: "не в работе", label: "Не в работе" },
    { status: "в аналитике", label: "Аналитика" },
    { status: "на согласовании", label: "На согласовании" },
    { status: "оценка", label: "Оценка" },
    { status: "готова к разработке", label: "Готова к разработке" },
    { status: "разработка", label: "Разработка" },
    { status: "ревью", label: "Ревью" },
    { status: "завершена", label: "Завершена" },
  ]

  const statusCounts: Record<TaskStatus, number> = {
    "не в работе": 0,
    "в аналитике": 0,
    "на согласовании": 0,
    оценка: 0,
    "готова к разработке": 0,
    разработка: 0,
    "ревью": 0,
    завершена: 0,
  }

  tasks.forEach((task) => {
    statusCounts[task.status] += 1
  })

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild className="bg-sky-200 text-sky-900 hover:bg-sky-300">
              <a href="https://risk.simpletracker.ru/" target="_blank" rel="noopener noreferrer">
                Планирование ресурсов команды разработки
              </a>
            </Button>

            <h1 className="text-2xl font-bold">Миноры</h1>
          </div>

          <div className="flex items-center gap-2">

            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Группировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без группировки</SelectItem>
                <SelectItem value="assignee">По исполнителю</SelectItem>
                <SelectItem value="status">По статусу</SelectItem>
                <SelectItem value="priority">По приоритету</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={onOpenSettings}>
              <SettingsIcon className="h-5 w-5" />
            </Button>

            <Button variant="outline" size="icon" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>

            <Button
              variant="secondary"
              className="flex items-center gap-2 px-3"
              onClick={onOpenAuth}
              title={user ? "Профиль" : "Войти"}
            >
              <User className="h-4 w-4" />
              <span className="whitespace-nowrap text-sm font-medium">
                {user?.name ?? "Войти"}
              </span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="px-4 py-2 select-none">
            <span className="font-semibold">Всего задач:</span>
            <span className="ml-2 font-bold">{tasks.length}</span>
          </Badge>

          {statusOrder.map(({ status, label }) => {
            const isSelected = selectedStatuses.includes(status)
            return (
              <Badge
                key={status}
                asChild
                variant={isSelected ? "default" : "secondary"}
                className="px-4 py-2 cursor-pointer select-none"
              >
                <button
                  type="button"
                  onClick={() => toggleSelectedStatus(status)}
                  className="flex items-center gap-2"
                  aria-pressed={isSelected}
                >
                  <span>{label}:</span>
                  <span className="font-bold">{statusCounts[status]}</span>
                </button>
              </Badge>
            )
          })}

          <span className="text-sm text-muted-foreground">
            Нажмите статус, чтобы скрыть или показать задачи по выбранным статусам
          </span>
        </div>
      </div>
    </header>
  )
}
