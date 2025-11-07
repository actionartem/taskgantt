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

// Используем только существующие экспорты из lib/api.ts
import {
  fetchTasks,
  createTaskNew,
  updateTaskNew,
  deleteTaskNew,
  getUsers,
  getBoardTags, // <-- теги берём отсюда
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
  const [settings, setSettingsState] = useState<AppSettings>({ executors: [], tags: [] })
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [groupBy, setGroupBy] = useState<GroupBy>("none")
  const [mounted, setMounted] = useState(false)

  // ---- утилита согласования старых/новых полей исполнителя
  // Главная правка: пустые/невалидные значения и 0 -> null, неизменённое поле -> undefined
  const safeAssigneeId = (t: Partial<Task>): number | null | undefined => {
    const anyT = t as any

    // 1) Явно передали число
    if (typeof anyT?.assigneeId === "number") {
      return anyT.assigneeId === 0 ? null : anyT.assigneeId
    }

    // 2) Явно null
    if (anyT?.assigneeId === null) return null

    // 3) Поддержка старого поля assignee (строка)
    if (anyT?.assignee != null) {
      const raw = String(anyT.assignee).trim().toLowerCase()
      if (raw === "" || raw === "none" || raw === "null" || raw === "undefined") return null

      const n = Number(raw)
      // Важно: Number("") === 0 — считаем отсутствием значения
      if (!Number.isFinite(n) || n === 0) return null
      return n
    }

    // 4) Поле не меняли — не отправляем
    return undefined
  }

  const refreshFromApi = useCallback(async () => {
    // Параллельно тянем пользователей, теги и задачи
    const [users, tags, apiTasks] = await Promise.all([
      getUsers(),
      // getBoardTags теперь может внутри ходить на /tags — id игнорируется
      getBoardTags(1),
      fetchTasks(),
    ])

    const executors = users.map((u) => ({
      id: String(u.id),
      name: u.name,
      role: (u as any).role_text ?? undefined,
    }))
    const tagNames = tags.map((t) => t.title)

    // --- НОВОЕ: переносим локальный флаг hiddenFromGantt по id,
    // если бэк его не отдаёт (или отдаёт как undefined)
    const localHiddenMap = storage.getTasks().reduce<Record<number, boolean>>((acc, t) => {
      acc[t.id] = !!t.hiddenFromGantt
      return acc
    }, {})

    const mergedTasks: Task[] = apiTasks.map((t: any) => ({
      ...t,
      hiddenFromGantt:
        t.hiddenFromGantt ??
        (t.hidden_from_gantt != null ? Boolean(t.hidden_from_gantt) : undefined) ??
        localHiddenMap[t.id] ??
        false,
    }))

    setSettingsState((prev) => {
      const merged: AppSettings = { ...prev, executors, tags: tagNames }
      storage.saveSettings(merged)
      return merged
    })

    setTasksState(mergedTasks)
    storage.saveTasks(mergedTasks)
  }, [])

  // Быстрая отрисовка из localStorage + последующее обновление с API
  useEffect(() => {
    setTasksState(storage.getTasks())
    setSettingsState(storage.getSettings())

    const savedTheme = storage.getTheme()
    setTheme(savedTheme)
    if (savedTheme === "dark") document.documentElement.classList.add("dark")

    setMounted(true)

    refreshFromApi().catch((e) => console.error("refreshFromApi failed:", e))
  }, [refreshFromApi])

  // --- публичные методы контекста
  const setTasks = (newTasks: Task[]) => {
    setTasksState(newTasks)
    storage.saveTasks(newTasks)
  }

  const addTask = (task: Task) => {
    // оптимистично
    setTasksState((prev) => {
      const next = [...prev, task]
      storage.saveTasks(next)
      return next
    })

    createTaskNew({
      id: task.id,
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
        setTasksState((prev) => {
          const next = prev.filter((t) => t.id !== task.id)
          storage.saveTasks(next)
          return next
        })
      })
  }

  const updateTask = (id: number, updates: Partial<Task>) => {
    // Оптимистично кладём в локальный стейт/LS
    setTasksState((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      storage.saveTasks(next)
      return next
    })

    // --- НОВОЕ: если меняется ТОЛЬКО hiddenFromGantt — НЕ трогаем API.
    const presentKeys = Object.keys(updates).filter(
      (k) => (updates as any)[k] !== undefined,
    )
    const onlyHideToggle = presentKeys.length === 1 && presentKeys[0] === "hiddenFromGantt"
    if (onlyHideToggle) {
      // Ничего не шлём — локально уже сохранено, гант сам отфильтрует.
      return
    }

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
        refreshFromApi().catch(() => {})
      })
  }

  const deleteTask = (id: number) => {
    const snapshot = tasks
    setTasksState((prev) => {
      const next = prev.filter((t) => t.id !== id)
      storage.saveTasks(next)
      return next
    })

    deleteTaskNew(id)
      .then(() => refreshFromApi())
      .catch((e) => {
        console.error("deleteTask failed:", e)
        setTasksState(snapshot)
        storage.saveTasks(snapshot)
      })
  }

  // >>> Безопасная запись настроек (важно!)
  const setSettings = (newSettings: AppSettings) => {
    if (!newSettings || typeof newSettings !== "object") {
      console.warn("Skip invalid settings:", newSettings)
      return
    }
    setSettingsState(newSettings)
    storage.saveSettings(newSettings)
  }

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    storage.saveTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  // value рассчитываем ДО guard'а, чтобы порядок хуков не менялся
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
    [tasks, settings, theme, groupBy],
  )

  if (!mounted) return null

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp must be used within AppProvider")
  return context
}
