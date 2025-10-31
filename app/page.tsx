"use client"

import { useEffect, useRef, useState } from "react"
import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react"
import { Header } from "@/components/header"
import { TaskList } from "@/components/task-list"
import { TaskForm } from "@/components/task-form"
import { GanttChart } from "@/components/gantt-chart"
import { Settings } from "@/components/settings"
import { AuthModal } from "@/components/auth-modal"
import type { Task } from "@/lib/types"
import { loginPassword, registerPassword } from "@/lib/api"

interface AuthenticatedUser {
  id?: number
  login: string
  name: string
  role_text?: string
}

export default function HomePage() {
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)

  // модалку по умолчанию НЕ показываем, пока не проверим localStorage
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const [leftWidth, setLeftWidth] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // при загрузке — пробуем достать юзера
  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = localStorage.getItem("st_user")
    if (raw) {
      try {
        const u = JSON.parse(raw)
        setCurrentUser(u)
        setIsAuthModalOpen(false)
        return
      } catch {
        localStorage.removeItem("st_user")
      }
    }
    // если юзера нет — показываем модалку
    setIsAuthModalOpen(true)
  }, [])

  // ресайзер
  useEffect(() => {
    if (!isResizing) return

    const handlePointerMove = (clientX: number) => {
      const container = containerRef.current
      if (!container) return

      const { left, width } = container.getBoundingClientRect()
      const offsetX = clientX - left
      const percentage = (offsetX / width) * 100
      const clamped = Math.min(80, Math.max(20, percentage))

      setLeftWidth(clamped)
    }

    const handleMouseMove = (event: MouseEvent) => {
      handlePointerMove(event.clientX)
    }

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      handlePointerMove(touch.clientX)
    }

    const handlePointerUp = () => {
      setIsResizing(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchmove", handleTouchMove, { passive: false })
    window.addEventListener("mouseup", handlePointerUp)
    window.addEventListener("touchend", handlePointerUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("mouseup", handlePointerUp)
      window.removeEventListener("touchend", handlePointerUp)
    }
  }, [isResizing])

  const startResizing = (event: ReactMouseEvent | ReactTouchEvent) => {
    event.preventDefault()
    setIsResizing(true)
  }

  const handleCreateTask = () => {
    setEditingTask(undefined)
    setShowTaskForm(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  const handleCloseTaskForm = () => {
    setShowTaskForm(false)
    setEditingTask(undefined)
  }

  // логин через БЭК
  const handleLogin = async ({
    login,
    password,
  }: {
    login: string
    password: string
  }) => {
    try {
      setAuthError(null)
      const user = await loginPassword(login, password)
      if (typeof window !== "undefined") {
        localStorage.setItem("st_user", JSON.stringify(user))
      }
      setCurrentUser({
        id: (user as any).id,
        login: (user as any).login,
        name: (user as any).name || (user as any).login,
        role_text: (user as any).role_text,
      })
      setIsAuthModalOpen(false)
    } catch (e: any) {
      setAuthError(e.message || "Не удалось войти")
      setIsAuthModalOpen(true)
    }
  }

  // регистрация через БЭК
  const handleRegister = async ({
    login,
    password,
    name,
  }: {
    login: string
    password: string
    name: string
  }) => {
    try {
      setAuthError(null)
      const user = await registerPassword(name, login, password, "")
      if (typeof window !== "undefined") {
        localStorage.setItem("st_user", JSON.stringify(user))
      }
      setCurrentUser({
        id: (user as any).id,
        login: (user as any).login,
        name: (user as any).name || name,
        role_text: (user as any).role_text,
      })
      setIsAuthModalOpen(false)
    } catch (e: any) {
      setAuthError(e.message || "Не удалось зарегистрироваться")
      setIsAuthModalOpen(true)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        onOpenSettings={() => setShowSettings(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        user={currentUser}
      />

      {/* если была ошибка авторизации — покажем вверху */}
      {authError ? (
        <div className="bg-red-500 text-white px-4 py-2 text-sm text-center">
          {authError}
        </div>
      ) : null}

      <main className="flex-1 overflow-hidden">
        <div ref={containerRef} className="flex h-full items-stretch p-4">
          <div
            className="flex min-w-[200px] flex-1 flex-col overflow-hidden"
            style={{ flexBasis: `${leftWidth}%` }}
          >
            <TaskList onCreateTask={handleCreateTask} onEditTask={handleEditTask} />
          </div>
          <div
            className="mx-4 flex w-1 cursor-col-resize items-stretch"
            onMouseDown={startResizing}
            onTouchStart={startResizing}
          >
            <div className="h-full w-full rounded bg-neutral-200 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600" />
          </div>
          <div
            className="flex min-w-[200px] flex-1 flex-col overflow-hidden"
            style={{ flexBasis: `${100 - leftWidth}%` }}
          >
            <GanttChart />
          </div>
        </div>
      </main>

      <TaskForm task={editingTask} open={showTaskForm} onClose={handleCloseTaskForm} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />

      <AuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    </div>
  )
}
