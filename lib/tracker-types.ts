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
  issue_role?: "az" | "legacy";
  epic_key?: string;
  epic_url?: string;
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
export interface AnalysisCycle {
  id: string;
  state: "approved" | "returned" | "stopped" | "customer" | "working" | "waiting";
  comments_at: string | null;
  started_at: string | null;
  sent_at: string | null;
  approved_at: string | null;
  response_at: string | null;
  started_by: string | null;
  waiting_ms: number | null;
  analysis_ms: number | null;
  review_ms: number | null;
  approval_ms: number | null;
  jira_approval_at: string | null;
  jira_approval_delay_ms: number | null;
  incomplete: boolean;
  facts: Array<{ type: string; at: string; actor: string | null; url: string }>;
}
export interface AnalysisStatistics {
  az: JiraSnapshot | null;
  automation_locked: boolean;
  blocked_reason: "approved_manual" | "outside_analysis" | null;
  history_complete: boolean;
  observed_until: string;
  cycles: AnalysisCycle[];
  summary: { cycles: number; measured_waits: number; average_wait_ms: number | null; analysis_ms: number | null; review_ms: number | null; approval_ms: number | null };
  schedule: { from: string; to: string; hours_per_day: number; partial_day: string; calendar_years: number[] };
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
