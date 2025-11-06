"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
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

import type { Task, TaskPriority, TaskStatus } from "@/lib/types"
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
  // ВАЖНО: работаем с id+name, чтобы API получал id, а UI — имя
  assigneeId: number | null
  assigneeName: string | null
  priority: TaskPriority
  tags: string[]
  statusLog: Task["statusLog"]
}

export function TaskForm({ task, open, onClose }: TaskFormProps) {
  const { addTask, updateTask, settings } = useApp()

  const executors = useMemo(() => settings?.executors ?? [], [settings?.executors])
  const allTags = useMemo(() => settings?.tags ?? [], [settings?.tags])

  const [formData, setFormData] = useState<FormState>({
    id: generateTaskId(),
    title: "",
    link: "",
    description: "",
    status: "не в работе",
    startDate: "",
    endDate: "",
    assigneeId: null,
    assigneeName: null,
    priority: "средний",
    tags: [],
    statusLog: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Подстановка при открытии
  useEffect(() => {
    if (task) {
      setFormData({
        id: task.id,
        title: task.title ?? "",
        link: (task as any).link ?? "",
        description: task.description ?? "",
        status: task.status,
        startDate: task.startDate ?? "",
        endDate: task.endDate ?? "",
        assigneeId:
          typeof task.assigneeId === "number"
            ? task.assigneeId
            : null,
        assigneeName: task.assigneeName ?? null,
        priority: task.priority ?? "средний",
        tags: Array.isArray(task.tags) ? task.tags : [],
        statusLog: Array.isArray(task.statusLog) ? task.statusLog : [],
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
        assigneeId: null,
        assigneeName: null,
        priority: "средний",
        tags: [],
        statusLog: [],
      })
    }
    setErrors({})
  }, [task, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}

    if (!formData.title.trim()) nextErrors.title = "Название обязательно"
    if (formData.id === "" || !validateTaskId(Number(formData.id))) {
      nextErrors.id = "ID должен быть 5-значным числом"
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    // Нормализуем объект для контекста
    const normalized: Partial<Task> = {
      id: Number(formData.id),
      title: formData.title.trim(),
      description: formData.description.trim(),
      status: formData.status,
      startDate: formData.startDate || "",
      endDate: formData.endDate || "",
      // ключевой момент: кладём и id, и name
      assigneeId: formData.assigneeId, // null — ОК, 0 — НЕЛЬЗЯ
      assigneeName: formData.assigneeName ?? null,
      priority: formData.priority,
      tags: Array.isArray(formData.tags) ? formData.tags : [],
      // link у нас кастомное поле в UI
      ...(formData.link ? { link: formData.link } : { link: "" }),
      statusLog: formData.statusLog,
    }

    if (task) {
      // патчим только изменившиеся поля не обязательно — апи-проекция
      updateTask(task.id, normalized)
    } else {
      // addTask принимает Task — но наш AppContext поддерживает optimistic и конвертирует
      addTask(normalized as Task)
    }

    onClose()
  }

  const handleTagToggle = (tag: string) => {
    setFormData((p) => {
      const set = new Set(p.tags)
      set.has(tag) ? set.delete(tag) : set.add(tag)
      return { ...p, tags: Array.from(set) }
    })
  }

  // Значение селекта исполнителя (строка id или "none")
  const assigneeSelectValue =
    formData.assigneeId != null ? String(formData.assigneeId) : "none"

  const onAssigneeChange = (value: string) => {
    if (value === "none") {
      setFormData((p) => ({ ...p, assigneeId: null, assigneeName: null }))
      return
    }
    const found = executors.find((e) => String(e.id) === value)
    setFormData((p) => ({
      ...p,
      assigneeId: found ? Number(found.id) : null,
      assigneeName: found?.name ?? null,
    }))
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
                value={formData.id}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === "") return setFormData((p) => ({ ...p, id: "" }))
                  const n = Number(raw)
                  if (Number.isFinite(n)) setFormData((p) => ({ ...p, id: n }))
                }}
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
              onChange={(e) => setFormData((p) => ({ ...p, link: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Описание задачи"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((p) => ({ ...p, status: value as TaskStatus }))}
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
                value={formData.priority}
                onValueChange={(value) => setFormData((p) => ({ ...p, priority: value as TaskPriority }))}
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
                value={formData.startDate}
                onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Дата окончания работ</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Исполнитель</Label>
            <Select value={assigneeSelectValue} onValueChange={onAssigneeChange}>
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
                  const active = formData.tags.includes(tag)
                  return (
                    <Badge
                      key={tag}
                      variant={active ? "default" : "outline"}
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

