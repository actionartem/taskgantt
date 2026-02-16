"use client"

import { useEffect, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react"

import { Header } from "@/components/header"
import { TaskList } from "@/components/task-list"
import { TaskForm } from "@/components/task-form"
import { GanttChart } from "@/components/gantt-chart"
import { Settings } from "@/components/settings"
import { AuthModal } from "@/components/auth-modal"
import { ProfileModal } from "@/components/profile-modal"
import { TaskHistorySection } from "@/components/task-history-section"
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

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const [leftWidth, setLeftWidth] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // при загрузке — читаем юзера
  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = localStorage.getItem("st_user")
    if (raw) {
      try {
        const u = JSON.parse(raw)
        setCurrentUser(u)
        return
      } catch {
        localStorage.removeItem("st_user")
      }
    }
    // если нет юзера — сразу показать авторизацию
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

    const handlePointerUp = () => setIsResizing(false)

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

  // ЛОГИН
  const handleLogin = async ({ login, password }: { login: string; password: string }) => {
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

  // РЕГИСТРАЦИЯ
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

  const handleLogout = () => {
    setAuthError(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("st_user")
    }
    setCurrentUser(null)
    setIsProfileModalOpen(false)
    setIsAuthModalOpen(true)
  }

  // КНОПКА В ХЕДЕРЕ
  const handleHeaderUserClick = () => {
    if (!currentUser) setIsAuthModalOpen(true)
    else setIsProfileModalOpen(true)
  }

  const isLocked = !currentUser

  return (
    <div className="mesh-grid relative flex h-screen flex-col">
      {/* Весь интерфейс в «заблокированном» контейнере */}
      <div className={isLocked ? "pointer-events-none select-none blur-sm saturate-75" : ""}>
        <Header
          onOpenSettings={() => setShowSettings(true)}
          onOpenAuth={handleHeaderUserClick}
          user={currentUser}
        />

        {authError ? (
          <div className="mx-4 mt-3 rounded-xl border border-red-400/70 bg-red-500/90 px-4 py-2 text-center text-sm text-white shadow-lg">{authError}</div>
        ) : null}

        <main className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col gap-4 px-4 pb-4 pt-3">
            <div ref={containerRef} className="flex min-h-[280px] flex-1 items-stretch gap-1">
              <div
                className="flex min-w-[200px] flex-1 flex-col overflow-hidden"
                style={{ flexBasis: `${leftWidth}%` }}
              >
                <TaskList onCreateTask={handleCreateTask} onEditTask={handleEditTask} />
              </div>
              <div
                className="mx-1 flex w-2 cursor-col-resize items-stretch rounded-full"
                onMouseDown={startResizing}
                onTouchStart={startResizing}
              >
                <div className="h-full w-full rounded-full bg-gradient-to-b from-primary/20 via-primary/45 to-primary/20 shadow-inner transition-all hover:from-primary/30 hover:via-primary/70 hover:to-primary/30" />
              </div>
              <div
                className="flex min-w-[200px] flex-1 flex-col overflow-hidden"
                style={{ flexBasis: `${100 - leftWidth}%` }}
              >
                <GanttChart onEditTask={handleEditTask} />
              </div>
            </div>
            <div className="h-[65vh] min-h-[600px]">
              <TaskHistorySection />
            </div>
          </div>
        </main>
        <footer className="px-4 pb-5">
          <div className="h-7 rounded-full border border-white/25 bg-gradient-to-r from-primary/15 via-background/85 to-chart-2/20 shadow-inner backdrop-blur" />
        </footer>

        <TaskForm task={editingTask} open={showTaskForm} onClose={handleCloseTaskForm} />
        <Settings open={showSettings} onClose={() => setShowSettings(false)} />
      </div>

      {/* Модалки размещаем вне блокирующего контейнера */}
      {!currentUser && (
        <AuthModal
          open={isAuthModalOpen}
          onOpenChange={setIsAuthModalOpen}
          onLogin={handleLogin}
          onRegister={handleRegister}
          locked={true}
        />
      )}

      {currentUser && (
        <ProfileModal
          open={isProfileModalOpen}
          onOpenChange={setIsProfileModalOpen}
          user={currentUser}
          onLogout={handleLogout}
          onUpdated={(u) => {
            setCurrentUser((prev) => (prev ? { ...prev, ...u } : prev))
            if (typeof window !== "undefined") {
              const raw = localStorage.getItem("st_user")
              if (raw) {
                try {
                  const parsed = JSON.parse(raw)
                  localStorage.setItem("st_user", JSON.stringify({ ...parsed, ...u }))
                } catch {
                  localStorage.setItem("st_user", JSON.stringify(u))
                }
              }
            }
          }}
        />
      )}
    </div>
  )
}
