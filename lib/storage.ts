// Работа с localStorage для хранения данных

import type { Task, AppSettings } from "./types"

const TASKS_KEY = "tasks"
const SETTINGS_KEY = "settings"
const THEME_KEY = "theme"

export const storage = {
  getTasks: (): Task[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(TASKS_KEY)
    return data ? JSON.parse(data) : []
  },

  saveTasks: (tasks: Task[]): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  },

  getSettings: (): AppSettings => {
    if (typeof window === "undefined") return { executors: [], tags: [] }
    const data = localStorage.getItem(SETTINGS_KEY)
    return data ? JSON.parse(data) : { executors: [], tags: [] }
  },

  saveSettings: (settings: AppSettings): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  },

  getTheme: (): "light" | "dark" => {
    if (typeof window === "undefined") return "light"
    return (localStorage.getItem(THEME_KEY) as "light" | "dark") || "light"
  },

  saveTheme: (theme: "light" | "dark"): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(THEME_KEY, theme)
  },
}
