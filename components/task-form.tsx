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

type FormState = {
  id: number | ""
  title: string
  link: string
  description: string
  status: TaskStatus
  startDate: string
  endDate: string
  /** Выбранный исполнитель в Select — строковый id или "none" */
  assigneeId: string
  priority: TaskPriority
  tags: string[]
}

export function TaskForm({ task, open, onClose }: TaskFormProps) {
  const { addTask, updateTask, settings } = useApp()

  // безопасные дефолты, чтобы не падать на undefined
  const executors = useMemo(() => settings?.executors ?? [], [settings?.executors])
  const allTags = useMemo(() => settings?.tags ?? [], [settings?.tags])

  const [form, setForm] = useState<FormState>({
    id: generateTaskId(),
    title: "",
    link: "",
    description: "",
    status: "не в работе",
    startDate: "",
    endDate: "",
    assigneeId: "none",
    priority: "средний",
    tags: [],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (task) {
      setForm({
        id: task.id,
        title: task.title ?? "",
        link: task.link ?? "",
        description: task.description ?? "",
        status: (task.status as TaskStatus) ?? "не в работе",
        startDate: task.startDate ?? "",
        endDate: task.endDate ?? "",
        assigneeId:
          task.assigneeId === null || task.assigneeId === undefined
            ? "none"
            : String(task.assigneeId),
        priority: (task.priority as TaskPriority) ?? "средний",
        tags: Array.isArray(task.tags) ? task.tags : [],
      })
    } else {
      setForm({
        id: generateTaskId(),
        title: "",
        link: "",
        description: "",
        status: "не в работе",
        startDate: "",
        endDate: "",
        assigneeId: "none",
        priority: "средний",
        tags: [],
      })
    }
    setErrors({})
  }, [task, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!form.title.trim()) newErrors.title = "Название обязательно"

    if (form.id === "" || !validateTaskId(form.id)) {
      newErrors.id = "ID должен быть 5-значным числом"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const normalized: Task = {
      id: Number(form.id),
      title: form.title.trim(),
      link: form.link.trim(),
      description: form.description.trim(),
      status: form.status,
      startDate: form.startDate || "",
      endDate: form.endDate || "",
      assigneeId: form.assigneeId !== "none" ? Number(form.assigneeId) : null,
      priority: form.priority,
      tags: Array.isArray(form.tags) ? form.tags : [],
    }

    if (task) {
      // частичное обновление, но мы передаём актуальный снимок
      updateTask(task.id, normalized)
    } else {
      addTask(normalized)
    }

    onClose()
  }

  const handleTagToggle = (tag: string) => {
    const current = Array.isArray(form.tags) ? form.tags : []
    if (current.includes(tag)) {
      setForm((p) => ({ ...p, tags: current.filter((t) => t !== tag) }))
    } else {
      setForm((p) => ({ ...p, tags: [...current, tag] }))
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
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
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
                value={form.id}
                onChange={(e) =>
                  setForm((p) => {
                    const n = Number(e.target.value)
                    return {
                      ...p,
                      id: Number.isFinite(n) ? n : p.id,
                    }
                  })
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
              value={form.link}
              onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Описание задачи"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((p) => ({ ...p, status: value as TaskStatus }))
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
                value={form.priority}
                onValueChange={(value) =>
                  setForm((p) => ({ ...p, priority: value as TaskPriority }))
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
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Дата окончания работ</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Исполнитель</Label>
            <Select
              value={form.assigneeId}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, assigneeId: value }))
              }
            >
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Выберите исполнителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {executors.map((exec) => (
                  <SelectItem key={exec.id} value={String(exec.id)}>
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
                  const isActive = Array.isArray(form.tags) && form.tags.includes(tag)
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

