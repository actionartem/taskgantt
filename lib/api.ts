// lib/api.ts

// Базовый адрес API
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://api.simpletracker.ru"

// Универсальная обёртка над fetch
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    let message = `API error ${res.status}`
    try {
      const data = await res.json()
      if ((data as any)?.error) message = (data as any).error
    } catch {
      const text = await res.text()
      if (text) message = text
    }
    throw new Error(message)
  }

  if (res.status === 204) {
    // @ts-expect-error — для 204 тела нет
    return {}
  }

  return res.json() as Promise<T>
}

/* ===================== TYPES ===================== */

export type Me = {
  id: number
  login: string
  name: string
  role_text?: string | null
  telegram_id?: string | null   // <-- важно для UI привязки
  is_superadmin?: boolean
}

export type TelegramRequestResponse = {
  ok: boolean
  user_id: string
  login: string
  code: string
  telegram_deeplink: string | null
}

/* ===================== AUTH ===================== */

export async function loginPassword(login: string, password: string) {
  return request<{
    id: number
    login: string
    name: string
    role_text?: string
    telegram_id?: string | null
    is_superadmin?: boolean
  }>("/auth/login-password", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  })
}

export async function registerPassword(
  name: string,
  login: string,
  password: string,
  roleText = "",
) {
  return request<{
    id: number
    login: string
    name: string
    role_text?: string
    telegram_id?: string | null
    is_superadmin?: boolean
  }>("/auth/register-password", {
    method: "POST",
    body: JSON.stringify({
      name,
      login,
      password,
      role_text: roleText,
    }),
  })
}

export async function getMe(userId: number | string) {
  return request<Me>(`/me?user_id=${userId}`)
}

// Запрос кода/ссылки для привязки Telegram
export async function requestTelegramLink(login: string) {
  return request<TelegramRequestResponse>("/auth/telegram/request", {
    method: "POST",
    body: JSON.stringify({ login }),
  })
}

/* ===================== USERS ===================== */

export async function getUsers() {
  return request<
    Array<{
      id: number
      login: string
      name: string
      role_text?: string
      telegram_id?: string | null
      is_superadmin?: boolean
    }>
  >("/users")
}

export async function updateUser(
  id: number | string,
  payload: { name?: string; role_text?: string },
) {
  return request<{
    id: number
    login: string
    name: string
    role_text?: string
    telegram_id?: string | null
    is_superadmin?: boolean
  }>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

/* ===================== BOARDS ===================== */

export async function getBoards(userId?: number | string) {
  const q = userId ? `?user_id=${userId}` : ""
  return request<
    Array<{ id: number; title: string; created_by?: number; created_at?: string }>
  >(`/boards${q}`)
}

/* ===================== TASKS ===================== */

export async function getTasks(
  boardId: number | string,
  params?: {
    assignee_id?: number | string
    status?: string
    priority?: string
    tag_id?: number | string
  },
) {
  const search = new URLSearchParams()
  if (params?.assignee_id) search.set("assignee_id", String(params.assignee_id))
  if (params?.status) search.set("status", params.status)
  if (params?.priority) search.set("priority", params.priority)
  if (params?.tag_id) search.set("tag_id", String(params.tag_id))
  const qs = search.toString() ? `?${search.toString()}` : ""
  return request<any[]>(`/boards/${boardId}/tasks${qs}`)
}

export async function createTask(
  boardId: number | string,
  payload: {
    title: string
    description?: string
    assignee_user_id?: number | null
    due_at?: string | null
    priority?: "low" | "medium" | "high"
    created_by?: number
  },
) {
  return request<{ id: number }>(`/boards/${boardId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateTask(
  taskId: number | string,
  payload: {
    title?: string
    description?: string
    status?: string
    assignee_user_id?: number | null
    due_at?: string | null
    priority?: "low" | "medium" | "high"
    updated_by?: number
  },
) {
  return request<any>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function getTaskHistory(taskId: number | string) {
  return request<
    Array<{
      id: number
      user_id: number | null
      user_name?: string | null
      action: string
      text: string | null
      created_at: string
    }>
  >(`/tasks/${taskId}/history`)
}

/* ===================== TAGS ===================== */

export async function getBoardTags(boardId: number | string) {
  return request<Array<{ id: number; board_id: number; title: string; color: string }>>(
    `/boards/${boardId}/tags`,
  )
}

export async function createBoardTag(
  boardId: number | string,
  payload: { title: string; color?: string },
) {
  return request<{ id: number; board_id: number; title: string; color: string }>(
    `/boards/${boardId}/tags`,
    { method: "POST", body: JSON.stringify(payload) },
  )
}

export async function deleteBoardTag(boardId: number | string, tagId: number | string) {
  return request<{}>(`/boards/${boardId}/tags/${tagId}`, { method: "DELETE" })
}

export async function attachTagToTask(taskId: number | string, tagId: number | string) {
  return request<{}>(`/tasks/${taskId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tag_id: tagId }),
  })
}

export async function detachTagFromTask(taskId: number | string, tagId: number | string) {
  return request<{}>(`/tasks/${taskId}/tags/${tagId}`, { method: "DELETE" })
}
