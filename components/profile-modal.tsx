"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, ExternalLink } from "lucide-react"
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
import { updateUser, requestTelegramLink } from "@/lib/api"
import { getMe, type Me } from "@/lib/api"

interface ProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id?: number
    login: string
    name: string
    role_text?: string
    telegram_id?: string | null // <-- добавили
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

  // Telegram
  const [tgLoading, setTgLoading] = useState(false)
  const [tgCode, setTgCode] = useState<string | null>(null)
  const [tgLink, setTgLink] = useState<string | null>(null)
  const [isTgLinked, setIsTgLinked] = useState<boolean>(Boolean(user.telegram_id))

  // синхронизация при смене пользователя
  useEffect(() => {
    setName(user.name)
    setRoleText(user.role_text || "")
    setShowPassword(false)
    setTgCode(null)
    setTgLink(null)
    setIsTgLinked(Boolean(user.telegram_id))
  }, [user.id, user.name, user.role_text, user.telegram_id])

  async function handleSave() {
    setError(null)
    setLoading(true)
    try {
      if (user.id) {
        await updateUser(user.id, { name, role_text: roleText })
      }
      onUpdated?.({ name, role_text: roleText })
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message || "Не удалось сохранить")
    } finally {
      setLoading(false)
    }
  }

  async function handleTelegramClick() {
    if (!user.login || isTgLinked) return
    setTgLoading(true)
    setError(null)
    try {
      const resp = await requestTelegramLink(user.login)
      setTgCode(resp.code || null)
      setTgLink(resp.telegram_deeplink || null)
    } catch (e: any) {
      setError(e.message || "Не удалось запросить привязку Telegram")
    } finally {
      setTgLoading(false)
    }
  }

  // Опрашиваем /me после получения кода — как только поле telegram_id появится, блокируем кнопку
  useEffect(() => {
    if (!tgCode || !user.id || isTgLinked) return
    let cancelled = false
    const until = Date.now() + 10 * 60 * 1000 // 10 минут

    const tick = async () => {
      if (cancelled) return
      try {
        const me: Me = await getMe(user.id!)
        if (me.telegram_id) {
          setIsTgLinked(true)
          setTgCode(null)
          setTgLink(null)
          return
        }
      } catch { /* ignore */ }
      if (!cancelled && Date.now() < until) {
        setTimeout(tick, 3000)
      }
    }

    const t = setTimeout(tick, 3000)
    return () => { cancelled = true; clearTimeout(t as any) }
  }, [tgCode, user.id, isTgLinked])

  function handleOpenTgLink() {
    if (!tgLink) return
    if (typeof window !== "undefined") {
      window.open(tgLink, "_blank")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Профиль пользователя</DialogTitle>
          <DialogDescription>
            Здесь можно изменить имя и роль, а ещё привязать Telegram.
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
            <p className="text-xs text-muted-foreground">Смену пароля сделаем позже.</p>
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

          {/* Telegram */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Telegram</p>
                <p className="text-xs text-muted-foreground">
                  {isTgLinked
                    ? "Привязан"
                    : tgCode
                    ? <>Код: <span className="font-mono">{tgCode}</span> (10 минут)</>
                    : "Ещё не привязан"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleTelegramClick}
                disabled={tgLoading || isTgLinked}
                title={isTgLinked ? "Telegram уже привязан" : ""}
              >
                {isTgLinked ? "Telegram привязан" : tgLoading ? "Запрос..." : "Привязать Telegram"}
              </Button>
            </div>

            {!isTgLinked && tgLink ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 flex items-center gap-2 px-0 text-sm text-primary"
                onClick={handleOpenTgLink}
              >
                Открыть в Telegram
                <ExternalLink className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}

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
