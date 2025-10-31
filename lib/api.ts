const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.simpletracker.ru";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }

  return res.json();
}

export async function loginPassword(login: string, password: string) {
  return request("/auth/login-password", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
}

export async function getBoards(userId: number) {
  return request(`/boards?user_id=${userId}`);
}

export async function getTasks(boardId: number) {
  return request(`/boards/${boardId}/tasks`);
}

export async function updateTask(taskId: number, payload: any) {
  return request(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
