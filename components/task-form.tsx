"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
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

  // основная форма
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

  // выбранный исполнитель (id из БД users)
  const [selectedExecutorId, setSelectedExecutorId] = useState<string>("")

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Быстрый поиск имени исполнителя по id
  const executorNameById = useMemo(() => {
    const map = new Map<string, string>()
    settings.executors.forEach((e) => map.set(String(e.id), e.name))
    return map
  }, [settings.executors])

  // Когда открываем/меняем задачу — инициализируем форму
  useEffect(() => {
    if (task) {
      setFormData(task)
      // если пришёл id исполнителя (на будущее), используем его;
      // иначе пытаемся найти по имени
      const incomingId =
        // @ts-expect-error поддержка кастомного поля до полной типизации
        (task as any).assignee_user_id != null ? String((task as any).assignee_user_id) : ""

      if (incomingId) {
        setSelectedExecutorId(incomingId)
      } else if (task.assignee) {
        const found = settings.executors.find((e) => e.name === task.assignee)
        setSelectedExecutorId(found ? String(found.id) : "")
      } else {
        setSelectedExecutorId("")
      }
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
      setSelectedExecutorId("")
    }
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, open, settings.executors])

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

    // вычисляем имя исполнителя по выбранному id
    const assigneeName = selectedExecutorId ? executorNameById.get(selectedExecutorId) || "" : ""

    // готовим полезную нагрузку: старое поле assignee (имя) + скрытое assignee_user_id
    const payload: Partial<Task> & { [k: string]: unknown } = {
      ...formData,
      assignee: assigneeName || "", // для текущего локального UI
    }
    payload.assignee_user_id = selectedExecutorId ? Number(selectedExecutorId) : null // на будущее, для API

    if (task) {
      updateTask(task.id, payload as Task)
    } else {
      addTask(payload as Task)
    }

    onClose()
  }

  const handleTagToggle = (tag: string) => {
    const current = formData.tags || []
    if (current.includes(tag)) {
      setFormData({ ...formData, tags: current.filter((t) => t !== tag) })
    } else {
      setFormData({ ...formData, tags: [...current, tag] })
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
            <Select
              value={selectedExecutorId || ""}
              onValueChange={(value) => setSelectedExecutorId(value)}
            >
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Выберите исполнителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Не назначен</SelectItem>
                {settings.executors.map((exec) => (
                  <SelectItem key={exec.id} value={String(exec.id)}>
                    {exec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Подсказка — показываем имя выбранного исполнителя */}
            {selectedExecutorId && (
              <p className="text-xs text-muted-foreground">
                Выбран: {executorNameById.get(selectedExecutorId)}
              </p>
            )}
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
