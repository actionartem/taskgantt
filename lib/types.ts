// =========================
// Типы для системы задач (UI)
// =========================

export type TaskStatus =
  | "не в работе"
  | "в аналитике"
  | "на согласовании"
  | "оценка"
  | "ревью"
  | "готова к разработке"
  | "разработка"
  | "завершена";

export type TaskPriority = "низкий" | "средний" | "высокий";

export interface Executor {
  id: number;       // из API приходит number
  name: string;
  role?: string | null; // role_text
}

export interface Task {
  // UI-модель (то, с чем работает приложение)
  id: number;                // пользовательский/числовой ID
  title: string;
  link?: string | null;      // ссылка на задачу (UI-поле "Ссылка на задачу")
  description: string | null;
  status: TaskStatus;
  statusLog: StatusChangeLog[];
  startDate?: string | null; // YYYY-MM-DD (UI)
  endDate?: string | null;   // YYYY-MM-DD (UI)
  assigneeId?: number | null;
  assigneeName?: string | null;
  priority: TaskPriority;
  approvedHours?: number | null;
  spentHours?: number | null;
  tags: string[];            // пока строки в UI (названия тегов)
  hiddenFromGantt?: boolean;
}

export interface StatusChangeLog {
  datetime: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  user?: string | null;
}

export type TaskHistoryField = "status" | "start_at" | "due_at";

export interface TaskHistoryEntry {
  field_name: TaskHistoryField;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface AppSettings {
  executors: Executor[];
  tags: string[]; // названия
}

export type GroupBy = "none" | "assignee" | "status" | "priority";

// Цвета для бейджей статусов/приоритетов в UI
export const STATUS_COLORS: Record<TaskStatus, string> = {
  "не в работе": "#9CA3AF",
  "в аналитике": "#3B82F6",
  "на согласовании": "#8B5CF6",
  оценка: "#F97316",
  "ревью": "#000000",
  "готова к разработке": "#14B8A6",
  разработка: "#22C55E",
  завершена: "#059669",
};

const STATUS_API_TO_RU_CANONICAL: Record<string, string> = {
  new: "не в работе",
  in_progress: "разработка",
  done: "завершена",
  review: "ревью",
};

export const normalizeStatusLabel = (value?: string | null): string => {
  if (!value) return "—";
  if (Object.prototype.hasOwnProperty.call(STATUS_COLORS, value)) {
    return value;
  }
  return STATUS_API_TO_RU_CANONICAL[value] ?? value;
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  низкий: "#9CA3AF",
  средний: "#F59E0B",
  высокий: "#EF4444",
};

// =========================
// Типы сырого API (backend)
// =========================

export type ApiPriority = "low" | "medium" | "high" | null;
export type ApiStatus = "new" | "in_progress" | "done" | string;

export interface ApiTag {
  id: number;
  title: string;
  color: string;
}

export interface ApiTask {
  // так приходит с бэка
  id: string; // bigint из PG как строка
  title: string;
  description: string | null;
  status: ApiStatus | null;
  priority: ApiPriority;
  assignee_user_id: number | string | null;
  start_at: string | null; // ISO
  due_at: string | null;   // ISO
  link_url: string | null;
  approved_hours?: number | string | null;
  spent_hours?: number | string | null;
  created_at: string;      // ISO
  updated_at: string;      // ISO
  assignee_name?: string | null;
  assignee_role?: string | null;
  tags: ApiTag[];
}

// =========================
// Маппинги RU ⇄ API
// =========================

export const PRIORITY_RU_TO_API: Record<TaskPriority, Exclude<ApiPriority, null>> = {
  низкий: "low",
  средний: "medium",
  высокий: "high",
};

export const PRIORITY_API_TO_RU: Record<Exclude<ApiPriority, null>, TaskPriority> = {
  low: "низкий",
  medium: "средний",
  high: "высокий",
};

// Статусы храним в API без потери конкретного UI-значения.
export const STATUS_RU_TO_API: Record<TaskStatus, ApiStatus> = {
  "не в работе": "не в работе",
  "в аналитике": "в аналитике",
  "на согласовании": "на согласовании",
  оценка: "оценка",
  "ревью": "ревью",
  "готова к разработке": "готова к разработке",
  разработка: "разработка",
  завершена: "завершена",
};

// Старые API-значения поддерживаем для совместимости с уже сохранёнными задачами.
export const STATUS_API_TO_RU = (s: ApiStatus | null): TaskStatus => {
  if (s === "new") return "не в работе";
  if (s === "in_progress") return "разработка";
  if (s === "done") return "завершена";
  if (s === "review") return "ревью";
  if (s && Object.prototype.hasOwnProperty.call(STATUS_COLORS, s)) return s as TaskStatus;
  return "не в работе";
};

// =========================
// Пэйлоады форм
// =========================

// Ввод для создания. id опционален — пользователь может задать свой.
export type CreateTaskInput = {
  id?: number;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: number | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null;   // YYYY-MM-DD
  link?: string | null;
  approvedHours?: number | null;
  spentHours?: number | null;
  tags?: string[];           // названия тегов в UI (пока)
};

// Частичное обновление
export type PatchTaskInput = Partial<CreateTaskInput> & {
  updatedBy?: number | null;
};
