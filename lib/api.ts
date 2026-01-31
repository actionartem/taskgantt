// lib/api.ts

import {
  Task,
  ApiTask,
  CreateTaskInput,
  PatchTaskInput,
  STATUS_API_TO_RU,
  STATUS_RU_TO_API,
  PRIORITY_API_TO_RU,
  PRIORITY_RU_TO_API,
  TaskHistoryEntry,
} from "./types"

/* ===================== BASE ===================== */

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ||
  "https://api.simpletracker.ru").replace(/\/$/, "")

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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
    // @ts-expect-error — у 204 тела нет
    return {}
  }
  return res.json() as Promise<T>
}

/* ===================== HELPERS ===================== */

function isoFromYmd(date?: string | null): string | null {
  if (!date) return null
  return new Date(`${date}T00:00:00.000Z`).toISOString()
}
function ymdFromIso(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toISOString().slice(0, 10)
}

/** Канонические соответствия — только 3 базовых статуса */
const CANONICAL_RU_TO_API: Record<string, string> = {
  "не в работе": "new",
  "разработка": "in_progress",
  "завершена": "done",
  "ревью": "review",
}
const CANONICAL_API_TO_RU: Record<string, string> = {
  new: "не в работе",
  in_progress: "разработка",
  done: "завершена",
  review: "ревью",
}

/** RU -> API: маппим только 3 канонических; любые другие — оставляем как есть */
function ruToApiStatusFlex(s?: string | null): string | null {
  if (!s) return null
  const key = s.toLowerCase()
  if (key in CANONICAL_RU_TO_API) return CANONICAL_RU_TO_API[key]
  return s
}

/** API -> RU: маппим только 3 канонических; любые другие — показываем как есть */
function apiToRuStatusFlex(s?: string | null): string {
  if (!s) return "не в работе"
  return CANONICAL_API_TO_RU[s] ?? s
}

/** API → UI */
function fromApiTask(t: ApiTask): Task {
  return {
    id: Number(t.id),
    title: t.title,
    description: t.description,
    status: apiToRuStatusFlex(t.status),
    priority: t.priority ? PRIORITY_API_TO_RU[t.priority] : "средний",
    assigneeId: t.assignee_user_id ? Number(t.assignee_user_id) : null,
    assigneeName: t.assignee_name ?? null,
    statusLog: Array.isArray((t as any).statusLog) ? (t as any).statusLog : [],
    startDate: ymdFromIso(t.start_at),
    endDate: ymdFromIso(t.due_at),
    link: t.link_url ?? null,
    tags: (t.tags || []).map((x) => x.title),
    hiddenFromGantt: false,
  }
}

/** UI (RU) → API */
function toApiCreate(input: CreateTaskInput) {
  return {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    description: input.description ?? null,
    status: input.status ? ruToApiStatusFlex(input.status) : "new",
    priority: input.priority ? PRIORITY_RU_TO_API[input.priority] : "medium",
    assignee_user_id:
      input.assigneeId === undefined ? null : input.assigneeId ?? null,
    start_at: isoFromYmd(input.startDate ?? null),
    due_at: isoFromYmd(input.endDate ?? null),
    link_url: input.link ?? null,
    created_by: input.assigneeId ?? null,
  }
}
function toApiPatch(patch: PatchTaskInput) {
  const out: Record<string, unknown> = {}
  if (patch.title !== undefined) out.title = patch.title
  if (patch.description !== undefined) out.description = patch.description ?? null
  if (patch.status !== undefined) out.status = ruToApiStatusFlex(patch.status!)
  if (patch.priority !== undefined)
    out.priority = PRIORITY_RU_TO_API[patch.priority!]
  if (patch.assigneeId !== undefined)
    out.assignee_user_id = patch.assigneeId ?? null
  if (patch.startDate !== undefined) out.start_at = isoFromYmd(patch.startDate ?? null)
  if (patch.endDate !== undefined) out.due_at = isoFromYmd(patch.endDate ?? null)
  if (patch.link !== undefined) out.link_url = patch.link ?? null
  if (patch.updatedBy !== undefined) out.updated_by = patch.updatedBy ?? null
  return out
}

/* ===================== TYPES (AUTH/USERS) ===================== */

export type Me = {
  id: number
  login: string
  name: string
  role_text?: string | null
  telegram_id?: string | null
  is_superadmin?: boolean
}

export type TelegramRequestResponse = {
  ok: boolean
  user_id: string
  login: string
  code: string
  telegram_deeplink: string | null
}

export type ApiUser = {
  id: number
  login: string
  name: string
  role_text?: string
  telegram_id?: string | null
  is_superadmin?: boolean
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
    body: JSON.stringify({ name, login, password, role_text: roleText }),
  })
}

export async function getMe(userId: number | string) {
  return request<Me>(`/me?user_id=${userId}`)
}

export async function getTaskHistory(taskId: number | string) {
  return request<TaskHistoryEntry[]>(`/tasks/${taskId}/history`)
}

export async function requestTelegramLink(login: string) {
  return request<TelegramRequestResponse>("/auth/telegram/request", {
    method: "POST",
    body: JSON.stringify({ login }),
  })
}

/* ===================== USERS ===================== */

export async function getUsers() {
  return request<ApiUser[]>("/users")
}

export async function createUser(name: string, roleText = "") {
  return request<{ id: number }>("/users", {
    method: "POST",
    body: JSON.stringify({ name, role_text: roleText }),
  })
}

export async function updateUser(
  id: number | string,
  payload: { name?: string; role_text?: string },
) {
  return request<ApiUser>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

/* ===================== TASKS (НОВЫЕ ЧИСТЫЕ ФУНКЦИИ) ===================== */

export async function fetchTasks(opts?: {
  search?: string
  status?: Task["status"]
  assigneeId?: number | null
  priority?: Task["priority"]
  tagId?: number
}): Promise<Task[]> {
  const q = new URLSearchParams()
  if (opts?.search) q.set("search", opts.search)
  if (opts?.status) q.set("status", ruToApiStatusFlex(opts.status))
  if (opts?.assigneeId) q.set("assignee_id", String(opts.assigneeId))
  if (opts?.priority) q.set("priority", PRIORITY_RU_TO_API[opts.priority])
  if (opts?.tagId) q.set("tag_id", String(opts.tagId))

  const data = await request<ApiTask[]>(
    `/tasks${q.toString() ? `?${q.toString()}` : ""}`,
  )
  return data.map(fromApiTask)
}

export async function createTaskNew(input: CreateTaskInput) {
  return request<{ id: number }>(`/tasks`, {
    method: "POST",
    body: JSON.stringify(toApiCreate(input)),
  })
}

export async function updateTaskNew(id: number, patch: PatchTaskInput) {
  const data = await request<ApiTask>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toApiPatch(patch)),
  })
  return fromApiTask(data)
}

export async function deleteTaskNew(id: number) {
  await request<void>(`/tasks/${id}`, { method: "DELETE" })
}

/* ===================== TASKS (ОБРАТНАЯ СОВМЕСТИМОСТЬ) ===================== */

export async function getTasks(
  _boardId?: number | string,
  params?: {
    assignee_id?: number | string
    status?: string
    priority?: string
    tag_id?: number | string
    search?: string
  },
) {
  const status =
    params?.status && (params.status as string)
      ? (params.status as Task["status"])
      : undefined
  const priority =
    params?.priority &&
    PRIORITY_RU_TO_API[params.priority as keyof typeof PRIORITY_RU_TO_API]
      ? (params.priority as Task["priority"])
      : undefined

  return fetchTasks({
    assigneeId: params?.assignee_id ? Number(params.assignee_id) : undefined,
    status,
    priority,
    tagId: params?.tag_id ? Number(params.tag_id) : undefined,
    search: params?.search,
  })
}

export async function createTask(
  _boardId: number | string,
  payload: {
    id?: number
    title: string
    description?: string
    assignee_user_id?: number | null
    start_at?: string | null
    due_at?: string | null
    link_url?: string | null
    priority?: "low" | "medium" | "high"
    status?: string
    created_by?: number
  },
) {
  const input: CreateTaskInput = {
    id: payload.id,
    title: payload.title,
    description: payload.description ?? null,
    assigneeId:
      payload.assignee_user_id === undefined ? null : payload.assignee_user_id,
    startDate: ymdFromIso(payload.start_at ?? null) ?? undefined,
    endDate: ymdFromIso(payload.due_at ?? null) ?? undefined,
    link: payload.link_url ?? null,
    priority: payload.priority
      ? PRIORITY_API_TO_RU[payload.priority]
      : "средний",
    status: payload.status ? apiToRuStatusFlex(payload.status as any) : "не в работе",
  }
  return createTaskNew(input)
}

export async function updateTask(
  taskId: number | string,
  payload: {
    title?: string
    description?: string
    status?: string
    assignee_user_id?: number | null
    start_at?: string | null
    due_at?: string | null
    link_url?: string | null
    priority?: "low" | "medium" | "high"
    updated_by?: number
  },
) {
  const patch: PatchTaskInput = {
    title: payload.title,
    description: payload.description,
    status: payload.status ? apiToRuStatusFlex(payload.status as any) : undefined,
    priority: payload.priority
      ? PRIORITY_API_TO_RU[payload.priority]
      : undefined,
    assigneeId:
      payload.assignee_user_id === undefined
        ? undefined
        : payload.assignee_user_id,
    startDate: ymdFromIso(payload.start_at ?? null) ?? undefined,
    endDate: ymdFromIso(payload.due_at ?? null) ?? undefined,
    link: payload.link_url ?? undefined,
    updatedBy:
      payload.updated_by === undefined ? undefined : payload.updated_by ?? null,
  }
  return updateTaskNew(Number(taskId), patch)
}

/* ===================== TAGS ===================== */

export async function getBoardTags(_boardId?: number | string) {
  return request<Array<{ id: number; title: string; color: string }>>(`/tags`)
}
export async function createBoardTag(
  _boardId: number | string,
  payload: { title: string; color?: string },
) {
  return request<{ id: number; title: string; color: string }>(`/tags`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
export async function deleteBoardTag(_boardId: number | string, tagId: number | string) {
  return request<{}>(`/tags/${tagId}`, { method: "DELETE" })
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

/* ===================== BOARDS (DEPRECATED) ===================== */
export async function getBoards(_userId?: number | string) {
  return Promise.resolve([{ id: 1, title: "Общие задачи", created_at: "" }])
}
