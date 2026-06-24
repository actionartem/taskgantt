"use client"

import { memo } from "react"
import { Download, Moon, SettingsIcon, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp } from "@/contexts/app-context"
import { cn } from "@/lib/utils"
import type { GroupBy, TaskStatus } from "@/lib/types"

interface HeaderProps {
  onOpenSettings: () => void
  onOpenAuth: () => void // используем и для входа, и для профиля
  onOpenExport: () => void
  user?: {
    id?: number
    name: string
    login: string
    role_text?: string
    telegram_id?: string | null // <-- добавлено, чтобы далее пробрасывать в модалку
    is_superadmin?: boolean
  } | null
}

export const Header = memo(function Header({ onOpenSettings, onOpenAuth, onOpenExport, user }: HeaderProps) {
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
    <header className="app-header">
      <div className="mx-auto flex min-h-14 w-full max-w-[1600px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2">
        <div className="order-1 flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-xs font-bold text-primary shadow-sm">
            ST
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-normal">SimpleTracker</div>
            <div className="text-[11px] font-medium text-muted-foreground">{tasks.length} задач</div>
          </div>
        </div>

        <div className="order-3 flex w-full min-w-0 max-w-full flex-wrap items-center justify-start gap-1.5 xl:order-2 xl:w-auto xl:flex-1 xl:justify-center">
          {statusOrder.map(({ status, label }) => {
            const isSelected = selectedStatuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleSelectedStatus(status)}
                className={cn(
                  "status-filter inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
                  isSelected
                    ? "border-primary/70 bg-primary text-primary-foreground shadow-md"
                    : "border-border/75 bg-background/65 text-foreground hover:border-primary/40 hover:bg-accent/70",
                )}
                aria-pressed={isSelected}
                title={`${label}: ${statusCounts[status]}`}
              >
                <span>{label}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {statusCounts[status]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="order-2 ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2 xl:order-3">
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
            <SelectTrigger className="h-8 w-[170px] max-w-full">
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
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onOpenSettings} title="Настройки">
              <SettingsIcon className="h-4 w-4" />
            </Button>
          ) : null}

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={toggleTheme} title="Тема">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <Button
            variant="secondary"
            className="flex h-8 max-w-[190px] items-center gap-2 px-3"
            onClick={onOpenAuth}
            title={user ? "Профиль" : "Войти"}
          >
            <User className="h-4 w-4" />
            <span className="truncate whitespace-nowrap text-sm font-medium">{user?.name ?? "Войти"}</span>
          </Button>

          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={onOpenExport}>
            <Download className="h-4 w-4" />
            <span className="whitespace-nowrap">Выгрузить EXEL</span>
          </Button>
        </div>
      </div>
    </header>
  )
})
