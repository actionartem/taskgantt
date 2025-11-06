"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

import type { Task, TaskStatus, TaskPriority } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { generateTaskId, validateTaskId } from "@/lib/task-utils"

// ⬇️ API для тегов
import {
  getBoardTags,
  attachTagToTask,
  detachTagFromTask,
} from "@/lib/api"

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

  const executors = useMemo(() => settings?.executors ?? [], [settings?.executors])
  const allTags = useMemo(() => settings?.tags ?? [], [settings?.tags])

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
      setFormData({
        ...task,
        tags: Array.isArray(task.tags) ? task.tags : [],
        assignee: typeof task.assignee === "string" ? task.assignee : "",
      })
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

  const handleTagToggle = (tag: string) => {
    const current = Array.isArray(formData.tags) ? formData.tags : []
    if (current.includes(tag)) {
      setFormData((p) => ({ ...p, tags: current.filter((t) => t !== tag) }))
    } else {
      setFormData((p) => ({ ...p, tags: [...current, tag] }))
    }
  }

  // ⬇️ утилита: синхронизация тегов задачи с БД
  async function syncTaskTags(taskId: number, desiredTitles: string[], prevTitles: string[]) {
    try {
      const apiTags = await getBoardTags(1) // глобальные теги
      const mapTitleToId = new Map(apiTags.map((t) => [t.title, t.id]))

      const desired = new Set((desiredTitles || []).filter(Boolean))
      const prev = new Set((prevTitles || []).filter(Boolean))

      const toAdd = [...desired].filter((t) => !prev.has(t))
      const toRemove = [...prev].filter((t) => !desired.has(t))

      await Promise.all(
        toAdd.map((title) => {
          const id = mapTitleToId.get(title)
          return id ? attachTagToTask(taskId, id) : Promise.resolve()
        }),
      )
      await Promise.all(
        toRemove.map((title) => {
          const id = mapTitleToId.get(title)
          return id ? detachTagFromTask(taskId, id) : Promise.resolve()
        }),
      )
    } catch (e) {
      console.error("syncTaskTags failed:", e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!formData.title?.trim()) newErrors.title = "Название обязательно"
    if (!formData.id || !validateTaskId(formData.id)) {
      newErrors.id = "ID должен быть 5-значным числом"
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const normalized: Task = {
      id: Number(formData.id),
      title: (formData.title || "").trim(),
      link: (formData.link || "").trim(),
      description: (formData.description || "").trim(),
      status: (formData.status as TaskStatus) || "не в работе",
      startDate: formData.startDate || "",
      endDate: formData.endDate || "",
      assignee: formData.assignee || "",
      priority: (formData.priority as TaskPriority) || "средний",
      tags: Array.isArray(formData.tags) ? formData.tags : [],
      statusLog: Array.isArray(formData.statusLog) ? formData.statusLog : [],
    }

    try {
      if (task) {
        // обновляем поля задачи
        updateTask(task.id, normalized)
        // синхронизируем теги по разнице
        await syncTaskTags(task.id, normalized.tags, Array.isArray(task.tags) ? task.tags : [])
      } else {
        // создаём
        addTask(normalized)
        // для новой задачи просто прикрепляем выбранные теги
        await syncTaskTags(Number(normalized.id), normalized.tags, [])
      }
    } finally {
      onClose()
    }
  }

  const assigneeValue =
    formData.assignee && formData.assignee.length > 0 ? formData.assignee : "none"

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
                value={formData.title ?? ""}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
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
                value={formData.id ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    id: Number.isFinite(Number(e.target.value))
                      ? Number(e.target.value)
                      : p.id,
                  }))
                }
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
              value={formData.link ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, link: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={formData.description ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Описание задачи"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Select
                value={(formData.status as TaskStatus) ?? "не в работе"}
                onValueChange={(value) =>
                  setFormData((p) => ({ ...p, status: value as TaskStatus }))
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Приоритет</Label>
              <Select
                value={(formData.priority as TaskPriority) ?? "средний"}
                onValueChange={(value) =>
                  setFormData((p) => ({ ...p, priority: value as TaskPriority }))
                }
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
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
                value={formData.startDate ?? ""}
                onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Дата окончания работ</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate ?? ""}
                onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Исполнитель</Label>
            <Select
              value={assigneeValue}
              onValueChange={(value) =>
                setFormData((p) => ({ ...p, assignee: value === "none" ? "" : value }))
              }
            >
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Выберите исполнителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {executors.map((exec) => (
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
              {allTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Нет доступных тегов. Добавьте их в настройках.
                </p>
              ) : (
                allTags.map((tag) => {
                  const isActive =
                    Array.isArray(formData.tags) && formData.tags.includes(tag)
                  return (
                    <Badge
                      key={tag}
                      variant={isActive ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                    </Badge>
                  )
                })
              )}
            </div>
          </div>

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

