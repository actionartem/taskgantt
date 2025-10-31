"use client"

import { type ChangeEvent, type FormEvent, useState } from "react"

import { Moon, Sun, SettingsIcon, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useApp } from "@/contexts/app-context"
import type { GroupBy } from "@/lib/types"

interface HeaderProps {
  onOpenSettings: () => void
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { tasks, theme, toggleTheme, groupBy, setGroupBy } = useApp()
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isTelegramLinked, setIsTelegramLinked] = useState(false)
  const [userForm, setUserForm] = useState({
    name: "Иван Петров",
    login: "ivan.petrov",
    password: "Пароль123",
    role: "Администратор",
    telegram: "@ivanpetrov",
  })

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

  const handleSaveUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsUserModalOpen(false)
  }

  const handleFieldChange = (field: "name" | "login" | "password") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setUserForm((previous) => ({ ...previous, [field]: event.target.value }))
    }

  const handleRoleChange = (value: string) => {
    setUserForm((previous) => ({ ...previous, role: value }))
  }

  const handleTelegramLink = () => {
    setIsTelegramLinked(true)
  }

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

            <Button
              variant="secondary"
              className="flex items-center gap-2 px-3"
              onClick={() => setIsUserModalOpen(true)}
            >
              <User className="h-4 w-4" />
              <span className="whitespace-nowrap text-sm font-medium">{userForm.name}</span>
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

      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Профиль пользователя</DialogTitle>
            <DialogDescription>
              Здесь можно изменить основные данные аккаунта. Пока данные заполняются статически, позже они будут загружаться с
              сервера.
            </DialogDescription>
          </DialogHeader>

          <form id="user-profile-form" onSubmit={handleSaveUser} className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Имя</Label>
                <Input id="user-name" value={userForm.name} onChange={handleFieldChange("name")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-login">Логин</Label>
                <Input id="user-login" value={userForm.login} onChange={handleFieldChange("login")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-password">Пароль</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={userForm.password}
                  onChange={handleFieldChange("password")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role">Роль</Label>
                <Select value={userForm.role} onValueChange={handleRoleChange}>
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Администратор">Администратор</SelectItem>
                    <SelectItem value="Менеджер">Менеджер</SelectItem>
                    <SelectItem value="Разработчик">Разработчик</SelectItem>
                    <SelectItem value="Аналитик">Аналитик</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Telegram</p>
                  <p className="text-sm text-muted-foreground">
                    {isTelegramLinked ? `Привязан: ${userForm.telegram}` : "Еще не привязан"}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleTelegramLink} disabled={isTelegramLinked}>
                  Привязать Telegram
                </Button>
              </div>
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsUserModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form="user-profile-form">
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
