"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateUser } from "@/lib/api"

interface ProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id?: number
    login: string
    name: string
    role_text?: string
  }
  onUpdated?: (u: { name: string; role_text?: string }) => void
}

export function ProfileModal({ open, onOpenChange, user, onUpdated }: ProfileModalProps) {
  const [name, setName] = useState(user.name)
  const [roleText, setRoleText] = useState(user.role_text || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // если модалку открыли для другого юзера — обновим поля
  useEffect(() => {
    setName(user.name)
    setRoleText(user.role_text || "")
  }, [user])

  async function handleSave() {
    setError(null)
    setLoading(true)
    try {
      // пароль и телеграм сейчас не шлём — в бэке у нас пока PATCH /users/:id только name + role_text
      if (user.id) {
        await updateUser(user.id, {
          name,
          role_text: roleText,
        })
      }
      onUpdated?.({ name, role_text: roleText })
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message || "Не удалось сохранить")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Профиль пользователя</DialogTitle>
          <DialogDescription>
            Здесь можно изменить основные данные аккаунта. Позже будем грузить прямо с сервера.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Имя</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-login">Логин</Label>
            <Input id="profile-login" value={user.login} disabled className="bg-muted" />
          </div>

          {/* Поле пароля пока как заглушка */}
          <div className="space-y-2">
            <Label htmlFor="profile-password">Пароль</Label>
            <Input
              id="profile-password"
              type="password"
              value="********"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Смену пароля добавим, когда сделаем эндпоинт.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-role">Роль</Label>
            <Input
              id="profile-role"
              value={roleText}
              onChange={(e) => setRoleText(e.target.value)}
              placeholder="например, Администратор"
            />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Telegram</p>
                <p className="text-xs text-muted-foreground">Ещё не привязан</p>
              </div>
              <Button variant="outline" size="sm" type="button">
                Привязать Telegram
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Сохраняю..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
