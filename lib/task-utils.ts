// Утилиты для работы с задачами

import type { Task, TaskPriority, TaskStatus, StatusChangeLog, GroupBy } from "./types"

export function generateTaskId(): number {
  // Генерация 5-значного ID
  return Math.floor(10000 + Math.random() * 90000)
}

export function validateTaskId(id: number): boolean {
  return id >= 10000 && id <= 99999
}

export function addStatusChange(task: Task, newStatus: TaskStatus): StatusChangeLog[] {
  const log: StatusChangeLog = {
    datetime: new Date().toISOString(),
    oldStatus: task.status,
    newStatus,
    user: "Текущий пользователь",
  }
  return [...task.statusLog, log]
}

export function filterTasks(
  tasks: Task[],
  filters: {
    search?: string
    status?: TaskStatus | "Все"
    assignee?: string
    tag?: string
    priority?: TaskPriority | "Все"
  },
): Task[] {
  return tasks.filter((task) => {
    // Поиск по названию и ID
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = task.title.toLowerCase().includes(searchLower)
      const matchesId = task.id.toString().includes(filters.search)
      if (!matchesTitle && !matchesId) return false
    }

    // Фильтр по статусу
    if (filters.status && filters.status !== "Все") {
      if (task.status !== filters.status) return false
    }

    // Фильтр по исполнителю
    if (filters.assignee && filters.assignee !== "Все") {
      if (task.assignee !== filters.assignee) return false
    }

    // Фильтр по тегу
    if (filters.tag && filters.tag !== "Все") {
      if (!task.tags.includes(filters.tag)) return false
    }

    // Фильтр по приоритету
    if (filters.priority && filters.priority !== "Все") {
      if (task.priority !== filters.priority) return false
    }

    return true
  })
}

export function groupTasks(tasks: Task[], groupBy: GroupBy): Record<string, Task[]> {
  if (groupBy === "none") {
    return { all: tasks }
  }

  const grouped: Record<string, Task[]> = {}

  tasks.forEach((task) => {
    let key: string

    if (groupBy === "assignee") {
      key = task.assignee || "Без исполнителя"
    } else if (groupBy === "status") {
      key = task.status
    } else {
      key = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "Без приоритета"
    }

    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(task)
  })

  return grouped
}
