// Работа с localStorage для хранения данных

import type { Task, AppSettings, Board } from "./types"

const TASKS_KEY = "tasks"
const SETTINGS_KEY = "settings"
const THEME_KEY = "theme"
const BOARDS_KEY = "boards"
const CURRENT_BOARD_KEY = "currentBoard"

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

  getBoards: (): Board[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(BOARDS_KEY)
    return data ? JSON.parse(data) : []
  },

  saveBoards: (boards: Board[]): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(BOARDS_KEY, JSON.stringify(boards))
  },

  getCurrentBoardId: (): string | null => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(CURRENT_BOARD_KEY)
  },

  saveCurrentBoardId: (boardId: string | null): void => {
    if (typeof window === "undefined") return
    if (!boardId) {
      localStorage.removeItem(CURRENT_BOARD_KEY)
      return
    }
    localStorage.setItem(CURRENT_BOARD_KEY, boardId)
  },
}
