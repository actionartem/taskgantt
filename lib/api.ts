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

const AUTH_EXPIRED_EVENT = "simpletracker:auth-expired"

function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem("st_user")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.token === "string" && parsed.token ? parsed.token : null
  } catch {
    return null
  }
}

function clearStoredAuth() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem("st_user")
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

function forgetStoredAuth() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem("st_user")
}

export class ApiError extends Error {
  constructor(public status:number,message:string,cause?:unknown){super(message,{cause});this.name='ApiError'}
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getStoredAuthToken()
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(API_BASE + path, {
    credentials: "include",
    signal: AbortSignal.timeout(30000),
    ...options,
    headers,
  }).catch((cause:unknown)=>{throw new ApiError(0,'Связь прервалась. Не удалось получить ответ сервера.',cause)})

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/") && token===getStoredAuthToken()) {
      clearStoredAuth()
    }
    let message = `API error ${res.status}`
    try {
      const data = await res.json()
      if ((data as any)?.error) message = (data as any).error
    } catch {
      // The response body may already have been consumed.
    }
    throw new ApiError(res.status,message)
  }

  if (res.status === 204) {
    // @ts-expect-error — у 204 тела нет
    return {}
  }
  return res.json().catch((cause:unknown)=>{throw new ApiError(0,'Не удалось прочитать ответ сервера',cause)}) as Promise<T>
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
function numberFromApi(value?: number | string | null): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** RU -> API: сохраняем конкретный UI-статус без схлопывания в in_progress. */
function ruToApiStatusFlex(s?: string | null): string | null {
  if (!s) return null
  return STATUS_RU_TO_API[STATUS_API_TO_RU(s as any)]
}

/** API -> RU: поддерживает старые английские и новые русские значения. */
function apiToRuStatusFlex(s?: string | null): Task["status"] {
  return STATUS_API_TO_RU((s ?? null) as any)
}

/** API → UI */
function fromApiTask(t: ApiTask): Task {
  return {
    id: Number(t.id),
    title: t.title,
    description: t.description,
    emailThread: t.email_thread ?? null,
    documentHistory: t.document_history ?? null,
    status: apiToRuStatusFlex(t.status),
    priority: t.priority ? PRIORITY_API_TO_RU[t.priority] : "средний",
    assigneeId: t.assignee_user_id ? Number(t.assignee_user_id) : null,
    assigneeName: t.assignee_name ?? null,
    statusLog: Array.isArray((t as any).statusLog) ? (t as any).statusLog : [],
    startDate: ymdFromIso(t.start_at),
    endDate: ymdFromIso(t.due_at),
    link: t.link_url ?? null,
    approvedHours: numberFromApi(t.approved_hours),
    spentHours: numberFromApi(t.spent_hours),
    tags: (t.tags || []).map((x) => x.title),
    deadlineConfirmed: t.deadline_confirmed ?? false,
    nextActionAt: t.next_action_at, nextActionText: t.next_action_text,
    replyDueAt: t.reply_due_at, waitingFor: t.waiting_for,
  }
}

/** UI (RU) → API */
function toApiCreate(input: CreateTaskInput) {
  return {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    description: input.description ?? null,
    email_thread: input.emailThread ?? null,
    document_history: input.documentHistory ?? null,
    status: input.status ? ruToApiStatusFlex(input.status) : "не в работе",
    priority: input.priority ? PRIORITY_RU_TO_API[input.priority] : "medium",
    assignee_user_id:
      input.assigneeId === undefined ? null : input.assigneeId ?? null,
    start_at: isoFromYmd(input.startDate ?? null),
    due_at: isoFromYmd(input.endDate ?? null),
    link_url: input.link ?? null,
    approved_hours: input.approvedHours ?? null,
    spent_hours: input.spentHours ?? null,
    tags: input.tags ?? [], deadline_confirmed: input.deadlineConfirmed ?? false,
    next_action_at: input.nextActionAt ?? null, next_action_text: input.nextActionText ?? null,
    reply_due_at: input.replyDueAt ?? null, waiting_for: input.waitingFor ?? null,
  }
}
function toApiPatch(patch: PatchTaskInput) {
  const out: Record<string, unknown> = {}
  if (patch.title !== undefined) out.title = patch.title
  if (patch.description !== undefined) out.description = patch.description ?? null
  if (patch.emailThread !== undefined) out.email_thread = patch.emailThread ?? null
  if (patch.documentHistory !== undefined) {
    out.document_history = patch.documentHistory ?? null
  }
  if (patch.status !== undefined) out.status = ruToApiStatusFlex(patch.status!)
  if (patch.priority !== undefined)
    out.priority = PRIORITY_RU_TO_API[patch.priority!]
  if (patch.assigneeId !== undefined)
    out.assignee_user_id = patch.assigneeId ?? null
  if (patch.startDate !== undefined) out.start_at = isoFromYmd(patch.startDate ?? null)
  if (patch.endDate !== undefined) out.due_at = isoFromYmd(patch.endDate ?? null)
  if (patch.link !== undefined) out.link_url = patch.link ?? null
  if (patch.approvedHours !== undefined) out.approved_hours = patch.approvedHours ?? null
  if (patch.spentHours !== undefined) out.spent_hours = patch.spentHours ?? null
  if (patch.updatedBy !== undefined) out.updated_by = patch.updatedBy ?? null
  if (patch.tags !== undefined) out.tags = patch.tags
  if (patch.deadlineConfirmed !== undefined) out.deadline_confirmed = patch.deadlineConfirmed
  if (patch.nextActionAt !== undefined) out.next_action_at = patch.nextActionAt
  if (patch.nextActionText !== undefined) out.next_action_text = patch.nextActionText
  if (patch.replyDueAt !== undefined) out.reply_due_at = patch.replyDueAt
  if (patch.waitingFor !== undefined) out.waiting_for = patch.waitingFor
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

export type AuthenticatedUserResponse = Me & {
  token: string
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

export type TaskExportField =
  | "id"
  | "title"
  | "status"
  | "priority"
  | "assignee"
  | "approved_hours"
  | "spent_hours"
  | "link_url"
  | "start_at"
  | "due_at"
  | "tags"
  | "description"

export type TaskExportJob = {
  id: string
  status: "queued" | "running" | "done" | "error"
  progress: number
  fileName: string | null
  downloadUrl: string | null
  error: string | null
}

/* ===================== AUTH ===================== */

export async function loginPassword(login: string, password: string) {
  return request<AuthenticatedUserResponse>("/auth/login-password", {
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
  return request<AuthenticatedUserResponse>("/auth/register-password", {
    method: "POST",
    body: JSON.stringify({ name, login, password, role_text: roleText }),
  })
}

export async function getMe(userId?: number | string) {
  return request<Me>(`/me${userId ? `?user_id=${userId}` : ""}`)
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

export async function logout() {
  const result = await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
  forgetStoredAuth();
  return result;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<AuthenticatedUserResponse>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
}

/* ===================== EXPORTS ===================== */

export async function startTaskExport(payload: {
  statuses: Task["status"][]
  fields: TaskExportField[]
}) {
  return request<TaskExportJob>("/exports/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getTaskExportJob(jobId: string) {
  return request<TaskExportJob>(`/exports/tasks/${encodeURIComponent(jobId)}`)
}

export async function downloadTaskExport(jobId: string, fallbackFileName?: string | null) {
  const headers: Record<string, string> = {}
  const token = getStoredAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/exports/tasks/${encodeURIComponent(jobId)}/download`, {
    credentials: "include",
    headers,
  })

  if (!res.ok) {
    if (res.status === 401) clearStoredAuth()
    throw new Error("Произошла ошибка выгрузки, повторите еще раз")
  }

  const blob = await res.blob()
  return {
    blob,
    fileName: fallbackFileName || `simpletracker-tasks-${jobId.slice(0, 8)}.xlsx`,
  }
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

export async function deleteUser(id: number | string) {
  return request<{}>(`/users/${id}`, { method: "DELETE" })
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
  if (opts?.status) {
    const apiStatus = ruToApiStatusFlex(opts.status)
    if (apiStatus) q.set("status", apiStatus)
  }
  if (opts?.assigneeId) q.set("assignee_id", String(opts.assigneeId))
  if (opts?.priority) q.set("priority", PRIORITY_RU_TO_API[opts.priority])
  if (opts?.tagId) q.set("tag_id", String(opts.tagId))

  const data = await request<ApiTask[]>(
    `/tasks${q.toString() ? `?${q.toString()}` : ""}`,
  )
  return data.map(fromApiTask)
}

async function saveTask(path: string, method: string, body: Record<string, unknown>, id?: number): Promise<Task> {
  try { return fromApiTask(await request<ApiTask>(path,{method,body:JSON.stringify(body)})); }
  catch(error) {
    // On ambiguous transport/server failure reconcile the intended fields before offering a retry.
    if (id && error instanceof ApiError && (error.status===0 || error.status>=500)) {
      try {
        const actual = await request<ApiTask>(`/tasks/${id}`);
        const match = Object.entries(body).every(([key,value]) => {
          if (['created_by','updated_by','id'].includes(key)) return true;
          const found = key==='tags' ? actual.tags.map(t=>t.title).sort() : (actual as unknown as Record<string,unknown>)[key];
          const expected = key==='tags' ? [...(value as string[])].sort() : value;
          if (key.endsWith('_at') && found && expected) return new Date(String(found)).getTime()===new Date(String(expected)).getTime();
          return JSON.stringify(found ?? null)===JSON.stringify(expected ?? null) || (typeof expected==='number' && Number(found)===expected);
        });
        if (match) return fromApiTask(actual);
      } catch { /* keep the original failure and the user's draft */ }
      throw new Error('Не удалось подтвердить сохранение. Черновик сохранён в форме. Проверьте соединение и повторите сохранение.',{cause:error});
    }
    throw error;
  }
}
export async function createTaskNew(input: CreateTaskInput) {
  return saveTask('/tasks','POST',toApiCreate(input),input.id);
}
export async function updateTaskNew(id: number, patch: PatchTaskInput) {
  return saveTask(`/tasks/${id}`,'PATCH',toApiPatch(patch),id);
}
export async function fetchTask(id:number) {return fromApiTask(await request<ApiTask>(`/tasks/${id}`));}

export async function downloadDocument(doc:{id:string;task_id:string;file_name:string|null}) {
  const token=getStoredAuthToken()
  const response=await fetch(`${API_BASE}/tasks/${doc.task_id}/documents/${doc.id}/download`,{credentials:'include',headers:token?{Authorization:`Bearer ${token}`}:{}})
  if(!response.ok)throw new Error('Не удалось скачать документ')
  const objectUrl=URL.createObjectURL(await response.blob())
  const a=document.createElement('a');a.href=objectUrl;a.download=doc.file_name||'document';a.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),10000)
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
    description?: string | null
    email_thread?: string | null
    document_history?: string | null
    assignee_user_id?: number | null
    start_at?: string | null
    due_at?: string | null
    link_url?: string | null
    approved_hours?: number | string | null
    spent_hours?: number | string | null
    priority?: "low" | "medium" | "high"
    status?: string
    created_by?: number
  },
) {
  const input: CreateTaskInput = {
    id: payload.id,
    title: payload.title,
    description: payload.description ?? null,
    emailThread: payload.email_thread ?? null,
    documentHistory: payload.document_history ?? null,
    assigneeId:
      payload.assignee_user_id === undefined ? null : payload.assignee_user_id,
    startDate: payload.start_at === undefined ? undefined : ymdFromIso(payload.start_at),
    endDate: payload.due_at === undefined ? undefined : ymdFromIso(payload.due_at),
    link: payload.link_url ?? null,
    approvedHours: numberFromApi(payload.approved_hours),
    spentHours: numberFromApi(payload.spent_hours),
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
    description?: string | null
    email_thread?: string | null
    document_history?: string | null
    status?: string
    assignee_user_id?: number | null
    start_at?: string | null
    due_at?: string | null
    link_url?: string | null
    approved_hours?: number | string | null
    spent_hours?: number | string | null
    priority?: "low" | "medium" | "high"
    updated_by?: number
  },
) {
  const patch: PatchTaskInput = {
    title: payload.title,
    description: payload.description,
    emailThread: payload.email_thread,
    documentHistory: payload.document_history,
    status: payload.status ? apiToRuStatusFlex(payload.status as any) : undefined,
    priority: payload.priority
      ? PRIORITY_API_TO_RU[payload.priority]
      : undefined,
    assigneeId:
      payload.assignee_user_id === undefined
        ? undefined
        : payload.assignee_user_id,
    startDate: payload.start_at === undefined ? undefined : ymdFromIso(payload.start_at),
    endDate: payload.due_at === undefined ? undefined : ymdFromIso(payload.due_at),
    link: payload.link_url === undefined ? undefined : payload.link_url,
    approvedHours:
      payload.approved_hours === undefined ? undefined : numberFromApi(payload.approved_hours),
    spentHours:
      payload.spent_hours === undefined ? undefined : numberFromApi(payload.spent_hours),
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
