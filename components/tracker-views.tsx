"use client";
import { memo, useCallback, useEffect, useState } from "react";
import { ApprovedDocument, DownloadLink } from "./approved-document";
import { TaskHistory } from "./task-history";
import { AnalysisStatisticsModal } from "./analysis-statistics";
import { request } from "@/lib/api";
import { useApp } from "@/contexts/app-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  displayTime,
  displayDays,
  type TaskDocument,
  type AttentionItem,
  type JiraSnapshot,
} from "@/lib/tracker-types";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Не удалось загрузить данные";
export function DocumentsView({
  onOpenTask,
}: {
  onOpenTask: (id: number) => void;
}) {
  const [docs, setDocs] = useState<TaskDocument[]>([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const { tasks, lastRefresh } = useApp();
  useEffect(() => {
    let live = true;
    setLoading(true);
    request<TaskDocument[]>("/documents?latest=approved")
      .then((d) => {
        if (live) {
          setDocs(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [lastRefresh]);
  const visible = docs.filter(
    (d) =>
      `${d.task_id} ${tasks.find((t) => t.id === Number(d.task_id))?.title || ""} ${d.title}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="tracker-section">
      <div className="section-tools">
        <input
          placeholder="Задача или название документа"
          aria-label="Поиск документов"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="tracker-error">
          {error}
        </p>
      )}
      {loading && !docs.length ? (
        <p>Загрузка…</p>
      ) : visible.length ? (
        visible.map((d) => (
          <article className="document-row" key={d.id}>
            <button onClick={() => onOpenTask(Number(d.task_id))}>
              #{d.task_id}
            </button>
            <div>
              <b>
                {d.title}
              </b>
              <small>{tasks.find(t => t.id === Number(d.task_id))?.title}</small>
            </div>
            <span>{d.approved_at ? `Согласован ${new Date(d.approved_at).toLocaleDateString("ru-RU", {timeZone:"Europe/Moscow"})}` : "Согласован; дата согласования неизвестна"}</span>
            <DownloadLink doc={d} />
          </article>
        ))
      ) : (
        <p className="empty-state">
          Документов нет.
        </p>
      )}
    </section>
  );
}
export function AttentionView({
  onOpenTask,
}: {
  onOpenTask: (id: number) => void;
}) {
  const { settings, lastRefresh } = useApp(),
    [items, setItems] = useState<AttentionItem[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [showSnoozed, setShowSnoozed] = useState(false),
    [thresholds, setThresholds] = useState<Record<string, number>>({}),
    [settingsOpen, setSettingsOpen] = useState(false);
  const [snooze, setSnooze] = useState<{ task: string; key: string } | null>(
      null,
    ),
    [until, setUntil] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        request<AttentionItem[]>("/attention"),
        request<Record<string, number>>("/attention/settings"),
      ]);
      setItems(a);
      setThresholds(t);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, lastRefresh]);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const visible = items
    .map((i) => ({
      ...i,
      reasons: i.reasons.filter((r) => showSnoozed || !r.snoozed_until),
    }))
    .filter((i) => i.reasons.length);
  return (
    <section className="tracker-section">
      <div className="section-tools">
        <button onClick={() => setSettingsOpen((v) => !v)}>
          Пороги этапов
        </button>
        <label>
          <input
            type="checkbox"
            checked={showSnoozed}
            onChange={(e) => setShowSnoozed(e.target.checked)}
          />{" "}
          Показать отложенные
        </label>
      </div>
      {settingsOpen && (
        <div className="threshold-settings">
          {["в аналитике", "оценка", "разработка", "ревью"].map((s) => (
            <label key={s}>
              {s}, дней
              <input
                type="number"
                min="1"
                max="3650"
                placeholder="Не задан"
                value={thresholds[s] ?? ""}
                onChange={(e) =>
                  setThresholds((p) => {
                    const next = { ...p };
                    if (e.target.value) next[s] = Number(e.target.value);
                    else delete next[s];
                    return next;
                  })
                }
              />
            </label>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              void action(() =>
                request("/attention/settings", {
                  method: "PUT",
                  body: JSON.stringify(thresholds),
                }),
              )
            }
          >
            Сохранить пороги
          </button>
        </div>
      )}
      {error && (
        <p className="tracker-error" role="alert">
          {error}
        </p>
      )}
      {loading && !items.length ? (
        <p>Проверяю задачи…</p>
      ) : visible.length ? (
        visible.map((i) => (
          <article key={i.task_id} className="attention-row">
            <button
              className="attention-title"
              onClick={() => onOpenTask(Number(i.task_id))}
            >
              #{i.task_id} · {i.title}
            </button>
            <p>
              {settings.executors.find(
                (e) => String(e.id) === String(i.assignee_user_id),
              )?.name || "Ответственный не назначен"}
              {i.waiting_for ? ` · Ждём: ${i.waiting_for}` : ""}
            </p>
            {i.reasons.map((r) => (
              <div className="attention-reason" key={r.key}>
                <span>
                  <b>{r.label}</b>
                  <small>
                    {r.since
                      ? `С ${displayTime(r.since)} · ${displayDays(Date.now() - new Date(r.since).getTime())}`
                      : "Начало этапа неизвестно"}
                    {r.snoozed_until
                      ? ` · Отложено до ${displayTime(r.snoozed_until)}`
                      : ""}
                  </small>
                </span>
                <button
                  onClick={() => {
                    setSnooze({ task: i.task_id, key: r.key });
                    setUntil("");
                  }}
                >
                  Отложить
                </button>
              </div>
            ))}
            {i.next_action_text && (
              <p>Следующее действие: {i.next_action_text}</p>
            )}
          </article>
        ))
      ) : (
        <p className="empty-state">
          По заданным правилам сейчас нет сигналов, требующих внимания.
        </p>
      )}
      <Dialog
        open={!!snooze}
        onOpenChange={(open) => {
          if (!open) setSnooze(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отложить этот сигнал</DialogTitle>
            <DialogDescription className="sr-only">Настройка напоминания</DialogDescription>
          </DialogHeader>
          <label>
            До даты и времени
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          <button
            disabled={!until || busy}
            onClick={() =>
              void action(async () => {
                await request(`/tasks/${snooze!.task}/attention/snooze`, {
                  method: "POST",
                  body: JSON.stringify({
                    reason_key: snooze!.key,
                    until_at: new Date(until).toISOString(),
                  }),
                });
                setSnooze(null);
              })
            }
          >
            Отложить
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export const TaskDetails = memo(function TaskDetails({ taskId, readOnly = false }: { taskId: number; readOnly?: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false), [analysisOpen, setAnalysisOpen] = useState(false);
  const [jira, setJira] = useState<JiraSnapshot | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    request<{ jira: JiraSnapshot | null }>(`/tasks/${taskId}`).then(t => { if(live) { setJira(t.jira); setError(""); } })
      .catch(e => { if(live)setError(errorText(e)); });
    return () => { live = false; };
  }, [taskId]);
  const az = jira?.issue_role === "az" ? jira : null;
  return <div className="task-details">
    <div className="task-detail-buttons">
      <button type="button" className="history-button" onClick={() => setHistoryOpen(true)}>История изменений ↗</button>
      <button type="button" className="history-button" onClick={() => setAnalysisOpen(true)}>Статистика АЗ ↗</button>
    </div>
    <TaskHistory taskId={taskId} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    <AnalysisStatisticsModal taskId={taskId} open={analysisOpen} onClose={() => setAnalysisOpen(false)} />
    {error && <p role="alert" className="tracker-error">{error}</p>}
    <details>
      <summary>АЗ в Jira · {az?.issue_key || "не привязана"}</summary>
      {az ? <div className="detail-facts">
        <a href={az.url} target="_blank" rel="noreferrer">{az.issue_key} ↗</a>
        <span>Статус АЗ: {az.status}</span>
        <span>Исполнитель АЗ: {az.assignee || "Не назначен"}</span>
        <span>Проверено: {displayTime(az.checked_at)}</span>
        {az.epic_url && <a href={az.epic_url} target="_blank" rel="noreferrer">Эпик {az.epic_key} ↗</a>}
      </div> : <p>Агент привяжет дочернюю задачу по АЗ.</p>}
    </details>
    <ApprovedDocument taskId={taskId} readOnly={readOnly} />
  </div>;
});
