// Типы для системы управления задачами

export type TaskStatus =
  | "не в работе"
  | "в аналитике"
  | "на согласовании"
  | "оценка"
  | "готова к разработке"
  | "разработка"
  | "завершена"

export type TaskPriority = "низкий" | "средний" | "высокий"

export interface StatusChangeLog {
  datetime: string
  oldStatus: TaskStatus
  newStatus: TaskStatus
  user: string
}

export interface Task {
  id: number // 5-значное число
  title: string
  link?: string
  description: string
  status: TaskStatus
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  assignee?: string
  priority: TaskPriority
  tags: string[]
  statusLog: StatusChangeLog[]
  hiddenFromGantt?: boolean
}

export interface Executor {
  id: string
  name: string
  role?: string
}

export interface AppSettings {
  executors: Executor[]
  tags: string[]
}

export type GroupBy = "none" | "assignee" | "status" | "priority"

export const STATUS_COLORS: Record<TaskStatus, string> = {
  "не в работе": "#9CA3AF", // серый
  "в аналитике": "#3B82F6", // синий
  "на согласовании": "#8B5CF6", // фиолетовый
  оценка: "#F97316", // оранжевый
  "готова к разработке": "#14B8A6", // бирюзовый
  разработка: "#22C55E", // зелёный
  завершена: "#059669", // тёмно-зелёный
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  низкий: "#9CA3AF",
  средний: "#F59E0B",
  высокий: "#EF4444",
}
