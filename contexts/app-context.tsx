// app/contexts/app-context.tsx
"use client"

import type React from "react"
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react"

import type { Task, AppSettings, GroupBy } from "@/lib/types"
import { storage } from "@/lib/storage"

// Обновлённые API-обёртки
import {
  fetchTasks,
  createTaskNew,
  updateTaskNew,
  deleteTaskNew,
  getUsers,
  getTags, // <-- теги теперь глобальные
} from "@/lib/api"

interface AppContextType {
  tasks: Task[]
  settings: AppSettings
  theme: "light" | "dark"
  groupBy: GroupBy
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: number, updates: Partial<Task>) => void
  deleteTask: (id: number) => void
  setSettings: (settings: AppSettings) => void
  toggleTheme: () => void
  setGroupBy: (groupBy: GroupBy) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasksState] = useState<Task[]>([])
  const [settings, setSettingsState] = useState<AppSettings>({
    executors: [],
    tags: [],
  })
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [groupBy, setGroupBy] = useState<GroupBy>("none")
  const [mounted, setMounted] = useState(false)

  // ===== Внутренние утилиты =====
  const safeAssigneeId = (t: Partial<Task>): number | null | undefined => {
    // поддержка старого поля assignee (string) и нового assigneeId (number|null)
    const anyT = t as any
    if (typeof anyT?.assigneeId === "number") return anyT.assigneeId
    if (anyT?.assigneeId === null) return null
    if (anyT?.assignee != null) {
      const n = Number(anyT.assignee)
      return Number.isFinite(n) ? n : null
    }
    return undefined
  }

  const refreshFromApi = useCallback(async () => {
    // грузим пользователей + теги + задачи параллельно
    const [users, tags, apiTasks] = await Promise.all([
      getUsers(),  // [{ id, name, role_text? }]
      getTags(),   // [{ id, title, color }]
      fetchTasks() // реальные таски из БД
    ])

    // приводим исполнителей к твоему типу из settings (id — string)
    const executors = users.map((u) => ({
      id: String(u.id),
      name: u.name,
      role: (u as any).role_text ?? undefined,
    }))

    const tagNames = tags.map((t) => t.title)

    setSettingsState((prev) => {
      const merged: AppSettings = {
        ...prev,
        executors,
        tags: tagNames,
      }
      storage.saveSettings(merged) // кеш — как и раньше
      return merged
    })

    setTasksState(apiTasks)
    storage.saveTasks(apiTasks) // локальный кеш для «быстрой первой отрисовки»
  }, [])

  // Загрузка данных (быстрый кеш из localStorage + затем API)
  useEffect(() => {
    // 1) мгновенная отрисовка из localStorage
    setTasksState(storage.getTasks())
    setSettingsState(storage.getSettings())

    // 2) тема — без изменений
    const savedTheme = storage.getTheme()
    setTheme(savedTheme)
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark")
    }

    setMounted(true)

    // 3) подтягиваем свежие данные с API (заменит локальный кеш)
    refreshFromApi().catch((e) => {
      console.error("refreshFromApi failed:", e)
    })
  }, [refreshFromApi])

  // ===== сеттеры, совместимые с текущим кодом =====
  const setTasks = (newTasks: Task[]) => {
    setTasksState(newTasks)
    storage.saveTasks(newTasks)
  }

  // ====== CRUD через API с оптимистичными апдейтами ======
  const addTask = (task: Task) => {
    // Оптимистично добавим в UI
    setTasksState((prev) => {
      const next = [...prev, task]
      storage.saveTasks(next)
      return next
    })

    createTaskNew({
      id: task.id, // поддержка пользовательского ID
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority,
      assigneeId: safeAssigneeId(task),
      startDate: task.startDate ?? null,
      endDate: task.endDate ?? null,
      link: (task as any).link ?? null,
    })
      .then(() => refreshFromApi())
      .catch((e) => {
        console.error("addTask failed:", e)
        // откатываем оптимизм
        setTasksState((prev) => {
          const next = prev.filter((t) => t.id !== task.id)
          storage.saveTasks(next)
          return next
        })
      })
  }

  const updateTask = (id: number, updates: Partial<Task>) => {
    // Оптимистичный апдейт в UI
    setTasksState((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      storage.saveTasks(next)
      return next
    })

    updateTaskNew(id, {
      title: updates.title,
      description: updates.description,
      status: updates.status,
      priority: updates.priority,
      assigneeId: safeAssigneeId(updates),
      startDate: updates.startDate,
      endDate: updates.endDate,
      link: (updates as any).link,
    })
      .then(() => refreshFromApi())
      .catch((e) => {
        console.error("updateTask failed:", e)
        // если ошибка — перезагрузим с сервера фактическое состояние
        refreshFromApi().catch(() => {})
      })
  }

  const deleteTask = (id: number) => {
    // Оптимистично удалим в UI
    const prevSnapshot = tasks
    setTasksState((prev) => {
      const next = prev.filter((t) => t.id !== id)
      storage.saveTasks(next)
      return next
    })

    deleteTaskNew(id)
      .then(() => refreshFromApi())
      .catch((e) => {
        console.error("deleteTask failed:", e)
        // откат к снимку
        setTasksState(prevSnapshot)
        storage.saveTasks(prevSnapshot)
      })
  }

  const setSettings = (newSettings: AppSettings) => {
    setSettingsState(newSettings)
    storage.saveSettings(newSettings)
  }

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    storage.saveTheme(newTheme)
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  // ВАЖНО: хуки ниже должны вызываться всегда в одном и том же порядке.
  // Поэтому рассчитываем value ДО guard'а mounted.
  const value = useMemo<AppContextType>(
    () => ({
      tasks,
      settings,
      theme,
      groupBy,
      setTasks,
      addTask,
      updateTask,
      deleteTask,
      setSettings,
      toggleTheme,
      setGroupBy,
    }),
    [
      tasks,
      settings,
      theme,
      groupBy,
      setTasks,
      addTask,
      updateTask,
      deleteTask,
      setSettings,
      toggleTheme,
      setGroupBy,
    ],
  )

  // SSR-гард
  if (!mounted) return null

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within AppProvider")
  }
  return context
}
