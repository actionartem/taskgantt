"use client"

import { Moon, Sun, SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useApp } from "@/contexts/app-context"
import type { GroupBy } from "@/lib/types"

interface HeaderProps {
  onOpenSettings: () => void
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { tasks, theme, toggleTheme, groupBy, setGroupBy } = useApp()

  const totalTasks = tasks.length
  const inProgressTasks = tasks.filter(
    (task) =>
      task.status === "в аналитике" ||
      task.status === "на согласовании" ||
      task.status === "оценка" ||
      task.status === "готова к разработке" ||
      task.status === "разработка",
  ).length
  const completedTasks = tasks.filter((task) => task.status === "завершена").length

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold">Система управления задачами</h1>

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
          </div>
        </div>

        <div className="flex gap-3">
          <Badge variant="secondary" className="px-4 py-2">
            Всего задач: <span className="ml-2 font-bold">{totalTasks}</span>
          </Badge>
          <Badge variant="secondary" className="px-4 py-2">
            В работе: <span className="ml-2 font-bold">{inProgressTasks}</span>
          </Badge>
          <Badge variant="secondary" className="px-4 py-2">
            Завершено: <span className="ml-2 font-bold">{completedTasks}</span>
          </Badge>
        </div>
      </div>
    </header>
  )
}
