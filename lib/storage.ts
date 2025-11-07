// Работа с localStorage для хранения данных

import type { Task, AppSettings } from "./types"

const TASKS_KEY = "tasks"
const SETTINGS_KEY = "settings"
const THEME_KEY = "theme"

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw || raw === "undefined" || raw === "null" || raw === "") return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const storage = {
  getTasks: (): Task[] => {
    if (typeof window === "undefined") return []
    const parsed = safeParse<Task[]>(localStorage.getItem(TASKS_KEY), [])
    return Array.isArray(parsed) ? parsed : []
  },

  saveTasks: (tasks: Task[]): void => {
    if (typeof window === "undefined") return
    const toSave = Array.isArray(tasks) ? tasks : []
    localStorage.setItem(TASKS_KEY, JSON.stringify(toSave))
  },

  getSettings: (): AppSettings => {
    const fallback: AppSettings = { executors: [], tags: [] }
    if (typeof window === "undefined") return fallback

    const parsed = safeParse<any>(localStorage.getItem(SETTINGS_KEY), fallback)
    if (!parsed || typeof parsed !== "object") return fallback

    // Гарантируем корректную структуру
    if (!Array.isArray(parsed.executors)) parsed.executors = []
    if (!Array.isArray(parsed.tags)) parsed.tags = []

    return parsed as AppSettings
  },

  saveSettings: (settings: AppSettings): void => {
    if (typeof window === "undefined") return
    // Никогда не пишем мусор
    if (!settings || typeof settings !== "object") return

    const toSave: AppSettings = {
      executors: Array.isArray(settings.executors) ? settings.executors : [],
      tags: Array.isArray(settings.tags) ? settings.tags : [],
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave))
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
