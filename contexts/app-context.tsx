"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Task, AppSettings, GroupBy, Board } from "@/lib/types"
import { storage } from "@/lib/storage"

interface AppContextType {
  tasks: Task[]
  settings: AppSettings
  theme: "light" | "dark"
  groupBy: GroupBy
  boards: Board[]
  currentBoard: Board | null
  currentBoardId: string | null
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: number, updates: Partial<Task>) => void
  deleteTask: (id: number) => void
  setSettings: (settings: AppSettings) => void
  toggleTheme: () => void
  setGroupBy: (groupBy: GroupBy) => void
  addBoard: (name: string) => Board
  selectBoard: (boardId: string) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const createBoardId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createBoard = (name: string): Board => ({
  id: createBoardId(),
  name,
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasksState] = useState<Task[]>([])
  const [settings, setSettingsState] = useState<AppSettings>({
    executors: [],
    tags: [],
  })
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [groupBy, setGroupBy] = useState<GroupBy>("none")
  const [boards, setBoardsState] = useState<Board[]>([])
  const [currentBoardId, setCurrentBoardIdState] = useState<string | null>(null)
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

    const storedBoards = storage.getBoards()
    if (storedBoards.length === 0) {
      const defaultBoard = createBoard("Новая доска")
      setBoardsState([defaultBoard])
      storage.saveBoards([defaultBoard])
      setCurrentBoardIdState(defaultBoard.id)
      storage.saveCurrentBoardId(defaultBoard.id)
    } else {
      setBoardsState(storedBoards)
      const storedCurrentBoardId = storage.getCurrentBoardId()
      const fallbackBoardId =
        storedCurrentBoardId && storedBoards.some((board) => board.id === storedCurrentBoardId)
          ? storedCurrentBoardId
          : storedBoards[0].id
      setCurrentBoardIdState(fallbackBoardId)
      storage.saveCurrentBoardId(fallbackBoardId)
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

  const addBoard = (name: string): Board => {
    const trimmedName = name.trim() || "Новая доска"
    const board = createBoard(trimmedName)
    const updatedBoards = [...boards, board]
    setBoardsState(updatedBoards)
    storage.saveBoards(updatedBoards)
    setCurrentBoardIdState(board.id)
    storage.saveCurrentBoardId(board.id)
    return board
  }

  const selectBoard = (boardId: string) => {
    const exists = boards.some((board) => board.id === boardId)
    if (!exists) return
    setCurrentBoardIdState(boardId)
    storage.saveCurrentBoardId(boardId)
  }

  const currentBoard = boards.find((board) => board.id === currentBoardId) ?? null

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
        boards,
        currentBoard,
        currentBoardId,
        setTasks,
        addTask,
        updateTask,
        deleteTask,
        setSettings,
        toggleTheme,
        setGroupBy,
        addBoard,
        selectBoard,
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
