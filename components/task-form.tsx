"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { Task, TaskStatus, TaskPriority } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { generateTaskId, validateTaskId } from "@/lib/task-utils"

interface TaskFormProps {
  task?: Task
  open: boolean
  onClose: () => void
}

const STATUSES: TaskStatus[] = [
  "не в работе",
  "в аналитике",
  "на согласовании",
  "оценка",
  "готова к разработке",
  "разработка",
  "завершена",
]

const PRIORITIES: TaskPriority[] = ["низкий", "средний", "высокий"]

export function TaskForm({ task, open, onClose }: TaskFormProps) {
  const { addTask, updateTask, settings } = useApp()
  const [formData, setFormData] = useState<Partial<Task>>({
    id: generateTaskId(),
    title: "",
    link: "",
    description: "",
    status: "не в работе",
    startDate: "",
    endDate: "",
    assignee: "",
    priority: "средний",
    tags: [],
    statusLog: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (task) {
      setFormData(task)
    } else {
      setFormData({
        id: generateTaskId(),
        title: "",
        link: "",
        description: "",
        status: "не в работе",
        startDate: "",
        endDate: "",
        assignee: "",
        priority: "средний",
        tags: [],
        statusLog: [],
      })
    }
    setErrors({})
  }, [task, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!formData.title?.trim()) {
      newErrors.title = "Название обязательно"
    }

    if (!formData.id || !validateTaskId(formData.id)) {
      newErrors.id = "ID должен быть 5-значным числом"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (task) {
      updateTask(task.id, formData as Task)
    } else {
      addTask(formData as Task)
    }

    onClose()
  }

  const handleTagToggle = (tag: string) => {
    const currentTags = formData.tags || []
    if (currentTags.includes(tag)) {
      setFormData({ ...formData, tags: currentTags.filter((t) => t !== tag) })
    } else {
      setFormData({ ...formData, tags: [...currentTags, tag] })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Редактировать задачу" : "Создать задачу"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Название <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Название задачи"
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">
                ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="id"
                type="number"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: Number.parseInt(e.target.value) || 0 })}
                placeholder="12345"
                disabled={!!task}
              />
              {errors.id && <p className="text-xs text-destructive">{errors.id}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">Ссылка на задачу</Label>
            <Input
              id="link"
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Описание задачи"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Приоритет</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Дата начала работ</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Дата окончания работ</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Исполнитель</Label>
            <Select value={formData.assignee} onValueChange={(value) => setFormData({ ...formData, assignee: value })}>
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Выберите исполнителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {settings.executors.map((exec) => (
                  <SelectItem key={exec.id} value={exec.name}>
                    {exec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Теги</Label>
            <div className="flex flex-wrap gap-2">
              {settings.tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет доступных тегов. Добавьте их в настройках.</p>
              ) : (
                settings.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={formData.tags?.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {task && task.statusLog.length > 0 && (
            <div className="space-y-2">
              <Label>История изменений (последние 5)</Label>
              <div className="space-y-1 text-xs">
                {task.statusLog
                  .slice(-5)
                  .reverse()
                  .map((log, index) => (
                    <div key={index} className="p-2 bg-muted rounded">
                      <span className="text-muted-foreground">{new Date(log.datetime).toLocaleString("ru-RU")}</span>
                      {" — "}
                      <span>
                        {log.oldStatus} → {log.newStatus}
                      </span>
                      {" — "}
                      <span className="text-muted-foreground">{log.user}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">{task ? "Сохранить" : "Создать"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
