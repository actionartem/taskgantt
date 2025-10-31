"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"
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
  onLogout?: () => void
}

export function ProfileModal({
  open,
  onOpenChange,
  user,
  onUpdated,
  onLogout,
}: ProfileModalProps) {
  const [name, setName] = useState(user.name)
  const [roleText, setRoleText] = useState(user.role_text || "")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(user.name)
    setRoleText(user.role_text || "")
    setShowPassword(false)
  }, [user])

  async function handleSave() {
    setError(null)
    setLoading(true)
    try {
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

          <div className="space-y-2">
            <Label htmlFor="profile-password">Пароль</Label>
            <div className="relative">
              <Input
                id="profile-password"
                type={showPassword ? "text" : "password"}
                value="********"
                disabled
                className="pr-10 bg-muted"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            {onLogout ? (
              <Button variant="destructive" type="button" onClick={onLogout}>
                Выйти
              </Button>
            ) : null}

            <div className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Сохраняю..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
