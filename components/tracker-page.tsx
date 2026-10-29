"use client"

import { useCallback, useEffect, useState } from "react"

import { TrackerWorkspace } from "@/components/tracker-workspace"
import { IncidentsWorkspace } from "@/components/incidents-workspace"
import { TaskForm } from "@/components/task-form"
import { TaskExportModal } from "@/components/task-export-modal"
import { Settings } from "@/components/settings"
import { AuthModal } from "@/components/auth-modal"
import { ProfileModal } from "@/components/profile-modal"
import type { Task } from "@/lib/types"
import { getMe, loginPassword, logout, registerPassword } from "@/lib/api"
import { permissionsFor, type AccessRole } from "@/lib/permissions"
import { useApp } from "@/contexts/app-context"

interface AuthenticatedUser {
  id?: number
  login: string
  name: string
  role_text?: string
  telegram_id?: string | null
  is_superadmin?: boolean
  access_role?: AccessRole
  token?: string
}

export default function TrackerPage({ section = "tasks" }: { section?: "tasks" | "incidents" }) {
  const { refreshFromApi, clearTasksState } = useApp()
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const permissions = permissionsFor(currentUser)

  useEffect(() => {
    let live = true
    const refreshIdentity = () => {
      const raw = localStorage.getItem("st_user")
      if (!raw) return
      let stored: AuthenticatedUser
      try { stored = JSON.parse(raw) } catch { return }
      if (!stored.token) return
      void getMe().then(fresh => {
        if (!live || localStorage.getItem("st_user") !== raw) return
        const updated = { ...stored, ...fresh, role_text: fresh.role_text || undefined }
        localStorage.setItem("st_user", JSON.stringify(updated))
        setCurrentUser(updated)
      }).catch(() => {})
    }
    refreshIdentity()
    window.addEventListener("focus", refreshIdentity)
    return () => { live = false; window.removeEventListener("focus", refreshIdentity) }
  }, [])

  // при загрузке — читаем юзера
  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = localStorage.getItem("st_user")
    if (raw) {
      try {
        const u = JSON.parse(raw)
        if (!u?.token) {
          localStorage.removeItem("st_user")
          setIsAuthModalOpen(true)
          return
        }
        setCurrentUser(u)
        if (section === "tasks") refreshFromApi().catch((e) => console.error("refreshFromApi failed:", e))
        return
      } catch {
        localStorage.removeItem("st_user")
      }
    }
    // если нет юзера — сразу показать авторизацию
    setIsAuthModalOpen(true)
  }, [refreshFromApi, section])

  const handleCreateTask = useCallback(() => {
    if (!permissionsFor(currentUser).editTasks) return
    setEditingTask(undefined)
    setShowTaskForm(true)
  }, [currentUser])

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }, [])

  const handleCloseTaskForm = useCallback(() => {
    setShowTaskForm(false)
    setEditingTask(undefined)
  }, [])

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
        telegram_id: (user as any).telegram_id,
        is_superadmin: (user as any).is_superadmin,
        access_role: user.access_role,
        token: (user as any).token,
      })
      if (section === "tasks") await refreshFromApi().catch((e) => console.error("refreshFromApi failed:", e))
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
        telegram_id: (user as any).telegram_id,
        is_superadmin: (user as any).is_superadmin,
        access_role: user.access_role,
        token: (user as any).token,
      })
      if (section === "tasks") await refreshFromApi().catch((e) => console.error("refreshFromApi failed:", e))
      setIsAuthModalOpen(false)
    } catch (e: any) {
      setAuthError(e.message || "Не удалось зарегистрироваться")
      setIsAuthModalOpen(true)
    }
  }

  const handleLogout = async () => {
    setAuthError(null)
    try {await logout()} catch(e) {setAuthError(e instanceof Error?e.message:'Не удалось выйти');return}
    if (typeof window !== "undefined") {
      localStorage.removeItem("st_user")
    }
    setShowTaskForm(false)
    setShowSettings(false)
    setEditingTask(undefined)
    clearTasksState()
    setCurrentUser(null)
    setIsProfileModalOpen(false)
    setIsAuthModalOpen(true)
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleAuthExpired = () => {
      setAuthError("Сессия истекла. Войдите снова.")
      setShowSettings(false)
      clearTasksState()
      setCurrentUser(null)
      setIsProfileModalOpen(false)
      setIsAuthModalOpen(true)
    }

    window.addEventListener("simpletracker:auth-expired", handleAuthExpired)
    return () => window.removeEventListener("simpletracker:auth-expired", handleAuthExpired)
  }, [clearTasksState])

  // КНОПКА В ХЕДЕРЕ
  const handleHeaderUserClick = useCallback(() => {
    if (!currentUser) setIsAuthModalOpen(true)
    else setIsProfileModalOpen(true)
  }, [currentUser])

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true)
  }, [])

  const handleOpenExport = useCallback(() => {
    setShowExportModal(true)
  }, [])

  return (
    <div className="app-shell">
      {currentUser ? (
        <>
          {authError && <p className="tracker-error" role="alert">{authError}</p>}
          {section === "incidents" ? (
            <IncidentsWorkspace key={currentUser.id || currentUser.login} onProfile={handleHeaderUserClick} canEdit={permissions.editIncidents} />
          ) : (
            <TrackerWorkspace onCreate={handleCreateTask} onEdit={handleEditTask} onSettings={handleOpenSettings} onExport={handleOpenExport} onProfile={handleHeaderUserClick} canEdit={permissions.editTasks} />
          )}

          <TaskExportModal open={showExportModal} onOpenChange={setShowExportModal} />
          <Settings open={showSettings} onClose={() => setShowSettings(false)} canManageUsers={permissions.manageUsers} />
        </>
      ) : authError ? (
        <div className="bg-red-500 text-white px-4 py-2 text-sm text-center">{authError}</div>
      ) : null}

      <TaskForm task={editingTask} open={!!currentUser && showTaskForm} onClose={handleCloseTaskForm} readOnly={!permissions.editTasks} />
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
