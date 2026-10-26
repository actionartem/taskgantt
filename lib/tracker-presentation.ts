import type { Task, TaskStatus } from "./types";
import type { TrackerEvent } from "./tracker-types";

export const STATUS_TONES: Record<TaskStatus, string> = {
  "не в работе": "#979186",
  "в аналитике": "#7199b6",
  "на согласовании": "#bb9551",
  оценка: "#a38bb9",
  "готова к разработке": "#70a299",
  разработка: "#4d4943",
  ревью: "#b5759c",
  завершена: "#83a377",
};

const NEXT_ACTION: Record<TaskStatus, string | null> = {
  "не в работе": "Определить следующий этап",
  "в аналитике": "Подготовить описание задачи",
  "на согласовании": "Получить согласование",
  оценка: "Получить оценку работ",
  "готова к разработке": "Запланировать начало разработки",
  разработка: "Завершить разработку",
  ревью: "Проверить результат разработки",
  завершена: null,
};
export function nextAction(task: Pick<Task, "status" | "nextActionText" | "waitingFor">) {
  if (task.status === "завершена") return null;
  return task.nextActionText?.trim() || (task.status === "на согласовании" && task.waitingFor?.trim()
    ? `Получить согласование · ${task.waitingFor.trim()}` : NEXT_ACTION[task.status]);
}

export function simpleHistory(events: TrackerEvent[]) {
  return events.map(event => ({ ...event, changes: Object.fromEntries(
    Object.entries(event.changes).filter(([key, value]) =>
      ["status", "assignee", "assignee_user_id"].includes(key) &&
      String(value.old ?? "") !== String(value.new ?? "")),
  ) })).filter(event => Object.keys(event.changes).length > 0).sort((a, b) => {
    // An unknown event date stays unknown; receipt time is only a stable sort fallback.
    const at = Date.parse(a.occurred_at || a.received_at), bt = Date.parse(b.occurred_at || b.received_at);
    return bt - at || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
}

export function inHoursPeriod(date: string | null, period: string) {
  return period === "all" || Boolean(date?.startsWith(period + "-"));
}
