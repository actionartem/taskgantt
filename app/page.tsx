"use client"

import { useEffect, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react"
import { Header } from "@/components/header"
import { TaskList } from "@/components/task-list"
import { TaskForm } from "@/components/task-form"
import { GanttChart } from "@/components/gantt-chart"
import { Settings } from "@/components/settings"
import { AuthModal } from "@/components/auth-modal"
import type { Task } from "@/lib/types"

interface AuthenticatedUser {
  login: string
  name: string
}

export default function HomePage() {
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true)
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null)
  const [leftWidth, setLeftWidth] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handlePointerMove = (clientX: number) => {
      const container = containerRef.current
      if (!container) {
        return
      }

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
      if (!touch) {
        return
      }

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

  const handleLogin = ({ login }: { login: string; password: string }) => {
    setCurrentUser({ login, name: login })
  }

  const handleRegister = ({ login, name }: { login: string; password: string; name: string }) => {
    setCurrentUser({ login, name })
  }

  return (
    <div className="flex h-screen flex-col">
      <Header onOpenSettings={() => setShowSettings(true)} onOpenAuth={() => setIsAuthModalOpen(true)} user={currentUser} />

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
        onLogin={(data) => {
          handleLogin(data)
        }}
        onRegister={(data) => {
          handleRegister(data)
        }}
      />
    </div>
  )
}
