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
import { useApp } from "@/contexts/app-context"

// API: пользователи
import { API_BASE, getUsers, createUser, updateUser } from "@/lib/api"
// API: теги
import { getBoardTags, createBoardTag, deleteBoardTag } from "@/lib/api"

interface SettingsProps {
  open: boolean
  onClose: () => void
}

export function Settings({ open, onClose }: SettingsProps) {
  const { settings, setSettings } = useApp()

  const [executorForm, setExecutorForm] = useState<Partial<Executor>>({ name: "", role: "" })
  const [editingExecutor, setEditingExecutor] = useState<string | null>(null)

  // Теги
  const [newTag, setNewTag] = useState("")
  const [tagLoading, setTagLoading] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)

  // Исполнители
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- helpers ---
  async function deleteUserApi(id: number | string) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) {
      let msg = `Delete failed: ${res.status}`
      try {
        const data = await res.json()
        if ((data as any)?.error) msg = (data as any).error
      } catch {
        const t = await res.text()
        if (t) msg = t
      }
      throw new Error(msg)
    }
  }

  // Загрузка пользователей и тегов при открытии
  useEffect(() => {
    if (!open) return

    // пользователи
    setListLoading(true)
    setError(null)
    getUsers()
      .then((users) => {
        const mapped: Executor[] = users.map((u) => ({
          id: String(u.id),
          name: u.name,
          role: u.role_text || "",
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
    const name = executorForm.name?.trim()
    const role = (executorForm.role || "").trim()
    if (!name) return

    setLoading(true)
    setError(null)
    try {
      const created = await createUser(name, role)
      const newExec: Executor = { id: String(created.id), name, role }
      setSettings((prev) => ({ ...prev, executors: [...prev.executors, newExec] }))
      setExecutorForm({ name: "", role: "" })
    } catch (e: any) {
      setError(e?.message || "Не удалось создать исполнителя")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateExecutor = async () => {
    const name = executorForm.name?.trim()
    if (!name || !editingExecutor) return

    setLoading(true)
    setError(null)
    try {
      await updateUser(editingExecutor, { name, role_text: executorForm.role || "" })
      setSettings((prev) => ({
        ...prev,
        executors: prev.executors.map((exec) =>
          exec.id === editingExecutor ? { ...exec, name, role: executorForm.role || "" } : exec,
        ),
      }))
      setExecutorForm({ name: "", role: "" })
      setEditingExecutor(null)
    } catch (e: any) {
      setError(e?.message || "Не удалось обновить исполнителя")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExecutor = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await deleteUserApi(id)
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
                  <Label htmlFor="executor-role">Роль (опционально)</Label>
                  <Input
                    id="executor-role"
                    value={executorForm.role || ""}
                    onChange={(e) => setExecutorForm({ ...executorForm, role: e.target.value })}
                    placeholder="Разработчик"
                  />
                </div>
              </div>

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
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditExecutor(executor)}
                          disabled={loading}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteExecutor(executor.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
