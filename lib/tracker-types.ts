export interface TrackerEvent {
  id: string;
  source: string;
  type: string;
  summary: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  actor_name: string | null;
  recorder: string;
  occurred_at: string | null;
  received_at: string;
  source_url: string | null;
  corrects_event_id: string | null;
}
export interface JiraSnapshot {
  task_id: string;
  issue_id: string | null;
  issue_key: string;
  url: string;
  status: string | null;
  assignee: string | null;
  checked_at: string | null;
  attempted_at: string | null;
  error: string | null;
  history_complete: boolean;
}
export interface TaskDocument {
  id: string;
  task_id: string;
  kind: "az" | "st" | "estimate" | "other";
  title: string;
  version: string;
  document_date: string | null;
  received_at: string;
  source_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_current: boolean;
  approved_at: string | null;
  approval_evidence: string | null;
}
export interface StageMetrics {
  totals: Record<string, number>;
  stages: Record<string, { milliseconds: number; entries: number }>;
  currentSince: string | null;
  observedSince: string | null;
  firstActive: string | null;
  firstDevelopment: string | null;
  complete: boolean;
  gaps: number;
  ageMilliseconds: number | null;
  beforeFirstActiveMilliseconds: number | null;
  paused: boolean;
  pauseSince: string | null;
  currentElapsedMilliseconds: number | null;
}
export interface AttentionItem {
  task_id: string;
  title: string;
  status: string;
  assignee_user_id: string | null;
  waiting_for: string | null;
  next_action_text: string | null;
  reasons: Array<{
    code: string;
    label: string;
    since: string | null;
    key: string;
    snoozed_until: string | null;
  }>;
}
export const DOCUMENT_KINDS = {
  az: "АЗ",
  st: "СТ",
  estimate: "Оценка",
  other: "Другие",
};
export const displayTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Время неизвестно";
export const displayDays = (ms: number | null) =>
  ms == null ? "Неизвестно" : `${Math.round(ms / 8640000) / 10} дн.`;
