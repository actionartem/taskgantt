"use client"

import { useState } from "react"
import { Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { Executor } from "@/lib/types"
import { useApp } from "@/contexts/app-context"

interface SettingsProps {
  open: boolean
  onClose: () => void
}

export function Settings({ open, onClose }: SettingsProps) {
  const { settings, setSettings } = useApp()
  const [executorForm, setExecutorForm] = useState<Partial<Executor>>({ name: "", role: "" })
  const [editingExecutor, setEditingExecutor] = useState<string | null>(null)
  const [newTag, setNewTag] = useState("")

  const handleAddExecutor = () => {
    if (!executorForm.name?.trim()) return

    const newExecutor: Executor = {
      id: Date.now().toString(),
      name: executorForm.name,
      role: executorForm.role,
    }

    setSettings({
      ...settings,
      executors: [...settings.executors, newExecutor],
    })

    setExecutorForm({ name: "", role: "" })
  }

  const handleUpdateExecutor = () => {
    if (!executorForm.name?.trim() || !editingExecutor) return

    setSettings({
      ...settings,
      executors: settings.executors.map((exec) =>
        exec.id === editingExecutor ? { ...exec, name: executorForm.name!, role: executorForm.role } : exec,
      ),
    })

    setExecutorForm({ name: "", role: "" })
    setEditingExecutor(null)
  }

  const handleDeleteExecutor = (id: string) => {
    setSettings({
      ...settings,
      executors: settings.executors.filter((exec) => exec.id !== id),
    })
  }

  const handleEditExecutor = (executor: Executor) => {
    setExecutorForm({ name: executor.name, role: executor.role })
    setEditingExecutor(executor.id)
  }

  const handleAddTag = () => {
    if (!newTag.trim()) return
    if (settings.tags.includes(newTag.trim())) return

    setSettings({
      ...settings,
      tags: [...settings.tags, newTag.trim()],
    })

    setNewTag("")
  }

  const handleDeleteTag = (tag: string) => {
    setSettings({
      ...settings,
      tags: settings.tags.filter((t) => t !== tag),
    })
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
                    value={executorForm.name}
                    onChange={(e) => setExecutorForm({ ...executorForm, name: e.target.value })}
                    placeholder="Иван Иванов"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="executor-role">Роль (опционально)</Label>
                  <Input
                    id="executor-role"
                    value={executorForm.role}
                    onChange={(e) => setExecutorForm({ ...executorForm, role: e.target.value })}
                    placeholder="Разработчик"
                  />
                </div>
              </div>

              <Button onClick={editingExecutor ? handleUpdateExecutor : handleAddExecutor} size="sm" className="w-full">
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
                >
                  Отменить редактирование
                </Button>
              )}

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
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteExecutor(executor.id)}
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
                    if (e.key === "Enter") {
                      handleAddTag()
                    }
                  }}
                />
                <Button onClick={handleAddTag} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {settings.tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 w-full">Нет тегов</p>
                ) : (
                  settings.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-2">
                      {tag}
                      <button onClick={() => handleDeleteTag(tag)} className="hover:text-destructive" type="button">
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
