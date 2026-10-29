"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { Executor } from "@/lib/types"
import { ACCESS_ROLE_LABELS, type AccessRole } from "@/lib/permissions"
import { useApp } from "@/contexts/app-context"

// API: пользователи
import { getUsers, createUser, updateUser, deleteUser } from "@/lib/api"
// API: теги
import { getBoardTags, createBoardTag, deleteBoardTag } from "@/lib/api"

interface SettingsProps {
  open: boolean
  onClose: () => void
  canManageUsers?: boolean
}

export function Settings({ open, onClose, canManageUsers = false }: SettingsProps) {
  const { settings, setSettings } = useApp()

  const [executorForm, setExecutorForm] = useState<Partial<Executor>>({ name: "", role: "" })
  const [editingExecutor, setEditingExecutor] = useState<number | null>(null)
  const [executorAccessRole, setExecutorAccessRole] = useState<AccessRole>("editor")
  const [createAccount, setCreateAccount] = useState(false)
  const [accountLogin, setAccountLogin] = useState("")
  const [accountPassword, setAccountPassword] = useState("")
  const editingSuperadmin = settings.executors.find(user => user.id === editingExecutor)?.isSuperadmin

  // Теги
  const [newTag, setNewTag] = useState("")
  const [tagLoading, setTagLoading] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)

  // Исполнители
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загрузка пользователей и тегов при открытии
  useEffect(() => {
    if (!open) { setAccountPassword(""); return }

    // пользователи
    setListLoading(true)
    setError(null)
    getUsers()
      .then((users) => {
        const mapped: Executor[] = users.map((u) => ({
          id: Number(u.id),
          name: u.name,
          role: u.role_text || "",
          accessRole: u.access_role,
          isSuperadmin: u.is_superadmin,
        }))
        setSettings((prev) => ({ ...prev, executors: mapped }))
      })
      .catch((e: any) => setError(e?.message || "Не удалось загрузить исполнителей"))
      .finally(() => setListLoading(false))

    // теги
    setTagLoading(true)
    setTagError(null)
    getBoardTags()
      .then((tags) => {
        setSettings((prev) => ({ ...prev, tags: tags.map((t) => t.title) }))
      })
      .catch((e: any) => setTagError(e?.message || "Не удалось загрузить теги"))
      .finally(() => setTagLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // --- Executors CRUD (через БД) ---
  const handleAddExecutor = async () => {
    if (!canManageUsers) return
    const name = executorForm.name?.trim()
    const role = (executorForm.role || "").trim()
    if (!name) return

    setLoading(true)
    setError(null)
    try {
      if (createAccount && (!accountLogin.trim() || accountPassword.length < 8)) throw new Error("Укажите логин и пароль не короче 8 символов")
      const created = await createUser(name, role, executorAccessRole, createAccount ? { login: accountLogin.trim(), password: accountPassword } : undefined)
      const newExec: Executor = { id: Number(created.id), name, role, accessRole: created.access_role, isSuperadmin: created.is_superadmin }
      setSettings((prev) => ({ ...prev, executors: [...prev.executors, newExec] }))
      setExecutorForm({ name: "", role: "" })
      setExecutorAccessRole("editor"); setCreateAccount(false); setAccountLogin(""); setAccountPassword("")
    } catch (e: any) {
      setError(e?.message || "Не удалось создать исполнителя")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateExecutor = async () => {
    if (!canManageUsers) return
    const name = executorForm.name?.trim()
    if (!name || !editingExecutor) return

    setLoading(true)
    setError(null)
    try {
      const saved = await updateUser(editingExecutor, { name, role_text: executorForm.role || "", ...(!editingSuperadmin ? { access_role: executorAccessRole } : {}) })
      setSettings((prev) => ({
        ...prev,
        executors: prev.executors.map((exec) =>
          exec.id === editingExecutor ? { ...exec, name, role: executorForm.role || "", accessRole: saved.access_role } : exec,
        ),
      }))
      setExecutorForm({ name: "", role: "" })
      setEditingExecutor(null)
      setExecutorAccessRole("editor")
    } catch (e: any) {
      setError(e?.message || "Не удалось обновить исполнителя")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExecutor = async (id: number) => {
    if (!canManageUsers) return
    setLoading(true)
    setError(null)
    try {
      await deleteUser(id)
      setSettings((prev) => ({ ...prev, executors: prev.executors.filter((exec) => exec.id !== id) }))
    } catch (e: any) {
      setError(e?.message || "Не удалось удалить исполнителя")
    } finally {
      setLoading(false)
    }
  }

  const handleEditExecutor = (executor: Executor) => {
    setExecutorForm({ name: executor.name, role: executor.role })
    setEditingExecutor(executor.id)
    setExecutorAccessRole(executor.accessRole || "editor")
    setAccountPassword("")
  }

  // --- Tags (через БД) ---
  const refreshTags = async () => {
    const tags = await getBoardTags()
    setSettings((prev) => ({ ...prev, tags: tags.map((t) => t.title) }))
  }

  const handleAddTag = async () => {
    const title = newTag.trim()
    if (!title) return
    // локальная проверка на дубль
    if (settings.tags.includes(title)) {
      setNewTag("")
      return
    }
    setTagLoading(true)
    setTagError(null)
    try {
      await createBoardTag(1, { title }) // boardId не используется на бэке, но параметр обязателен
      await refreshTags()
      setNewTag("")
    } catch (e: any) {
      setTagError(e?.message || "Не удалось создать тег")
    } finally {
      setTagLoading(false)
    }
  }

  const handleDeleteTag = async (title: string) => {
    setTagLoading(true)
    setTagError(null)
    try {
      // найдём id тега по title
      const tags = await getBoardTags()
      const found = tags.find((t) => t.title === title)
      if (found) {
        await deleteBoardTag(1, found.id)
      }
      await refreshTags()
    } catch (e: any) {
      setTagError(e?.message || "Не удалось удалить тег")
    } finally {
      setTagLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Исполнители */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Исполнители</h3>
            <fieldset disabled={!canManageUsers}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="executor-name">Имя исполнителя</Label>
                  <Input
                    id="executor-name"
                    value={executorForm.name || ""}
                    onChange={(e) => setExecutorForm({ ...executorForm, name: e.target.value })}
                    placeholder="Иван Иванов"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="executor-role">Должность (опционально)</Label>
                  <Input
                    id="executor-role"
                    value={executorForm.role || ""}
                    onChange={(e) => setExecutorForm({ ...executorForm, role: e.target.value })}
                    placeholder="Разработчик"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="executor-access-role">Права доступа</Label>
                {editingSuperadmin ? <p className="text-sm">Главный администратор — полный доступ</p> : <select id="executor-access-role" className="w-full rounded border p-2 text-sm" value={executorAccessRole} onChange={e => setExecutorAccessRole(e.target.value as AccessRole)}>{Object.entries(ACCESS_ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}
              </div>
              {!editingExecutor && <>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createAccount} onChange={e => { setCreateAccount(e.target.checked); setAccountPassword("") }} />Создать учётную запись для входа</label>
                {createAccount && <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="new-account-login">Логин</Label><Input id="new-account-login" autoComplete="off" value={accountLogin} onChange={e => setAccountLogin(e.target.value)} maxLength={64} /></div>
                  <div className="space-y-2"><Label htmlFor="new-account-password">Пароль</Label><Input id="new-account-password" type="password" autoComplete="new-password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} maxLength={256} /></div>
                </div>}
              </>}
              <Button
                onClick={editingExecutor ? handleUpdateExecutor : handleAddExecutor}
                size="sm"
                className="w-full"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" />
                {editingExecutor ? "Обновить исполнителя" : "Добавить исполнителя"}
              </Button>

              {editingExecutor && (
                <Button
                  onClick={() => {
                    setEditingExecutor(null)
                    setExecutorForm({ name: "", role: "" })
                    setExecutorAccessRole("editor"); setAccountPassword("")
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={loading}
                >
                  Отменить редактирование
                </Button>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}
              {listLoading && <p className="text-sm text-muted-foreground">Загрузка исполнителей…</p>}

              <div className="space-y-2">
                {settings.executors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет исполнителей</p>
                ) : (
                  settings.executors.map((executor) => (
                    <div key={executor.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{executor.name}</div>
                        {executor.role && <div className="text-sm text-muted-foreground">{executor.role}</div>}
                        <div className="text-xs text-muted-foreground">{executor.isSuperadmin ? "Главный администратор — полный доступ" : ACCESS_ROLE_LABELS[executor.accessRole || "editor"]}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditExecutor(executor)}
                          aria-label={`Изменить пользователя ${executor.name}`}
                          disabled={loading}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteExecutor(executor.id)}
                          aria-label={`Удалить пользователя ${executor.name}`}
                          disabled={loading || executor.isSuperadmin}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            </fieldset>
          </Card>

          {/* Теги */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Теги</h3>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Новый тег"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag()
                  }}
                  disabled={tagLoading}
                />
                <Button onClick={handleAddTag} size="sm" disabled={tagLoading}>
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </div>

              {tagError && <p className="text-sm text-red-500">{tagError}</p>}
              {tagLoading && <p className="text-sm text-muted-foreground">Синхронизация тегов…</p>}

              <div className="flex flex-wrap gap-2">
                {settings.tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 w-full">Нет тегов</p>
                ) : (
                  settings.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-2">
                      {tag}
                      <button
                        onClick={() => handleDeleteTag(tag)}
                        className="hover:text-destructive"
                        type="button"
                        disabled={tagLoading}
                        title="Удалить тег"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
