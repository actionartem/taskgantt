// lib/api.ts

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://api.simpletracker.ru";

// базовая обёртка
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  // если бэк вернул ошибку — попробуем прочитать её текст
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch (e) {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  // если тела нет (204) — вернём пустой объект
  if (res.status === 204) {
    // @ts-expect-error
    return {};
  }

  return res.json();
}

/* ------------------ AUTH ------------------ */

export async function loginPassword(login: string, password: string) {
  return request("/auth/login-password", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
}

export async function registerPassword(
  name: string,
  login: string,
  password: string,
  roleText = ""
) {
  return request("/auth/register-password", {
    method: "POST",
    body: JSON.stringify({
      name,
      login,
      password,
      role_text: roleText, // бэк его ждёт, даже если пустой
    }),
  });
}

export async function getMe(userId: number | string) {
  return request(`/me?user_id=${userId}`);
}

// запрос на привязку телеграма — получим код и deep-link
export async function requestTelegramLink(login: string) {
  return request("/auth/telegram/request", {
    method: "POST",
    body: JSON.stringify({ login }),
  });
}

/* ------------------ USERS ------------------ */

export async function getUsers() {
  return request("/users");
}

export async function updateUser(
  id: number | string,
  payload: { name?: string; role_text?: string }
) {
  return request(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/* ------------------ BOARDS ------------------ */

export async function getBoards(userId?: number | string) {
  const q = userId ? `?user_id=${userId}` : "";
  return request(`/boards${q}`);
}

/* ------------------ TASKS ------------------ */

export async function getTasks(
  boardId: number | string,
  params?: {
    assignee_id?: number | string;
    status?: string;
    priority?: string;
    tag_id?: number | string;
  }
) {
  const search = new URLSearchParams();
  if (params?.assignee_id) search.set("assignee_id", String(params.assignee_id));
  if (params?.status) search.set("status", params.status);
  if (params?.priority) search.set("priority", params.priority);
  if (params?.tag_id) search.set("tag_id", String(params.tag_id));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return request(`/boards/${boardId}/tasks${qs}`);
}

export async function createTask(
  boardId: number | string,
  payload: {
    title: string;
    description?: string;
    assignee_user_id?: number | null;
    due_at?: string | null;
    priority?: "low" | "medium" | "high";
    created_by?: number;
  }
) {
  return request(`/boards/${boardId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTask(
  taskId: number | string,
  payload: {
    title?: string;
    description?: string;
    status?: string;
    assignee_user_id?: number | null;
    due_at?: string | null;
    priority?: "low" | "medium" | "high";
    updated_by?: number;
  }
) {
  return request(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getTaskHistory(taskId: number | string) {
  return request(`/tasks/${taskId}/history`);
}

/* ------------------ TAGS ------------------ */

export async function getBoardTags(boardId: number | string) {
  return request(`/boards/${boardId}/tags`);
}

export async function createBoardTag(
  boardId: number | string,
  payload: { title: string; color?: string }
) {
  return request(`/boards/${boardId}/tags`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteBoardTag(
  boardId: number | string,
  tagId: number | string
) {
  return request(`/boards/${boardId}/tags/${tagId}`, {
    method: "DELETE",
  });
}

export async function attachTagToTask(
  taskId: number | string,
  tagId: number | string
) {
  return request(`/tasks/${taskId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tag_id: tagId }),
  });
}

export async function detachTagFromTask(
  taskId: number | string,
  tagId: number | string
) {
  return request(`/tasks/${taskId}/tags/${tagId}`, {
    method: "DELETE",
  });
}
