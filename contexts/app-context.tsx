"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Task, AppSettings, GroupBy } from "@/lib/types"
import { storage } from "@/lib/storage"

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

  // Загрузка данных из localStorage
  useEffect(() => {
    setTasksState(storage.getTasks())
    setSettingsState(storage.getSettings())
    const savedTheme = storage.getTheme()
    setTheme(savedTheme)
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark")
    }
    setMounted(true)
  }, [])

  const setTasks = (newTasks: Task[]) => {
    setTasksState(newTasks)
    storage.saveTasks(newTasks)
  }

  const addTask = (task: Task) => {
    const newTasks = [...tasks, task]
    setTasks(newTasks)
  }

  const updateTask = (id: number, updates: Partial<Task>) => {
    const newTasks = tasks.map((task) => (task.id === id ? { ...task, ...updates } : task))
    setTasks(newTasks)
  }

  const deleteTask = (id: number) => {
    const newTasks = tasks.filter((task) => task.id !== id)
    setTasks(newTasks)
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

  if (!mounted) {
    return null
  }

  return (
    <AppContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within AppProvider")
  }
  return context
}
