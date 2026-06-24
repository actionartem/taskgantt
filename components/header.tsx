"use client"

import { Moon, SettingsIcon, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp } from "@/contexts/app-context"
import { cn } from "@/lib/utils"
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
    is_superadmin?: boolean
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
      <div className="flex min-h-14 w-full items-center gap-3 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
          {statusOrder.map(({ status, label }) => {
            const isSelected = selectedStatuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleSelectedStatus(status)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-muted/60 text-foreground hover:bg-muted",
                )}
                aria-pressed={isSelected}
                title={`${label}: ${statusCounts[status]}`}
              >
                <span>{label}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-muted-foreground",
                  )}
                >
                  {statusCounts[status]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Группировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без группировки</SelectItem>
              <SelectItem value="assignee">По исполнителю</SelectItem>
              <SelectItem value="status">По статусу</SelectItem>
              <SelectItem value="priority">По приоритету</SelectItem>
            </SelectContent>
          </Select>

          {user?.is_superadmin ? (
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={onOpenSettings} title="Настройки">
              <SettingsIcon className="h-4 w-4" />
            </Button>
          ) : null}

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggleTheme} title="Тема">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <Button
            variant="secondary"
            className="flex h-9 max-w-[220px] items-center gap-2 px-3"
            onClick={onOpenAuth}
            title={user ? "Профиль" : "Войти"}
          >
            <User className="h-4 w-4" />
            <span className="truncate whitespace-nowrap text-sm font-medium">{user?.name ?? "Войти"}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
