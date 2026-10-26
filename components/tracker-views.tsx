"use client";
import { memo, useCallback, useEffect, useState, useRef } from "react";
import { ApprovedDocument, DownloadLink } from "./approved-document";
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
  type TrackerEvent,
  type StageMetrics,
  type JiraSnapshot,
} from "@/lib/tracker-types";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Не удалось загрузить данные";
const sourceLabel = (s: string) =>
  ({
    simpletracker: "SimpleTracker",
    jira: "Jira",
    "mail-agent": "Агент · почта",
    legacy: "Прежний журнал",
  })[s] || s;
const fieldLabel = (s: string) =>
  ({
    status: "Статус",
    assignee: "Исполнитель Jira",
    assignee_user_id: "Ответственный",
    title: "Название",
    description: "Описание",
    priority: "Приоритет",
    link_url: "Ссылка",
    email_thread: "Переписка",
    document_history: "Прежняя история документов",
    start_at: "Начало",
    due_at: "Окончание",
    tags: "Теги",
    approved_hours: "Согласованные часы",
    deadline_confirmed: "Срок подтверждён",
    next_action_at: "Срок действия",
    next_action_text: "Следующее действие",
    reply_due_at: "Срок ответа",
    waiting_for: "Чей ответ ждём",
    document: "Документ",
    is_current: "Актуальность",
    approved_at: "Согласовано",
    approval_evidence: "Основание согласования",
    jira_link: "Связь с Jira",
  })[s] || s;
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
            <span>Согласован {new Date(d.approved_at!).toLocaleDateString("ru-RU", {timeZone:"Europe/Moscow"})}</span>
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

export function TaskHistory({
  taskId,
  open,
  onClose,
}: {
  taskId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<TrackerEvent[]>([]),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    request<TrackerEvent[]>(`/tasks/${taskId}/events`)
      .then((e) => {
        if (live) {
          setEvents(e);
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
  }, [taskId, open]);
  const { settings } = useApp();
  const value = (field: string, v: unknown) =>
    v == null || v === ""
      ? "—"
      : field === "assignee_user_id"
        ? settings.executors.find((e) => e.id === Number(v))?.name || `#${v}`
        : field === "priority"
          ? { low: "низкий", medium: "средний", high: "высокий" }[String(v)] ||
            String(v)
          : ["start_at", "due_at"].includes(field)
            ? new Date(String(v)).toLocaleDateString("ru-RU", {
                timeZone: "Europe/Moscow",
              })
            : ["next_action_at", "reply_due_at", "approved_at"].includes(field)
              ? displayTime(String(v))
              : Array.isArray(v)
                ? v.join(", ") || "—"
                : typeof v === "boolean"
                  ? v
                    ? "да"
                    : "нет"
                  : String(v);
  const visible = events.filter(e => !e.changes.spent_hours || Object.keys(e.changes).some(k => k != "spent_hours")).filter(
    (e) =>
      filter === "all" ||
      (filter === "status"
        ? !!e.changes.status
        : filter === "assignee"
          ? !!(e.changes.assignee || e.changes.assignee_user_id)
          : e.type.startsWith("document.")),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="history-modal">
        <DialogHeader>
          <DialogTitle>История изменений · #{taskId}</DialogTitle>
          <DialogDescription className="sr-only">События задачи</DialogDescription>
        </DialogHeader>
        <div className="section-tools">
          {[
            ["all", "Все"],
            ["status", "Статусы"],
            ["assignee", "Исполнители"],
            ["documents", "Документы"],
          ].map(([k, v]) => (
            <button
              type="button"
              key={k}
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
            >
              {v}
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="event-list">
          {loading ? (
            <p>Загружаю историю…</p>
          ) : visible.length ? (
            visible.map((e) => (
              <article className="event-row" key={e.id}>
                <small>
                  {sourceLabel(e.source)} ·{" "}
                  {e.occurred_at
                    ? displayTime(e.occurred_at)
                    : "Точное время действия неизвестно"}
                </small>
                <b>
                  {e.type === "task.paused"
                    ? "Пауза · "
                    : e.type === "task.resumed"
                      ? "Возобновление · "
                      : ""}
                  {e.summary}
                </b>
                {e.actor_name && (
                  <span>
                    {e.actor_name}
                    {e.source !== "simpletracker"
                      ? " · по сведениям источника"
                      : ""}
                  </span>
                )}
                {Object.entries(e.changes).filter(([k]) => k !== "spent_hours").map(([k, v]) => (
                  <p key={k}>
                    {fieldLabel(k)}: <span>{value(k, v.old)}</span> →{" "}
                    <strong>{value(k, v.new)}</strong>
                  </p>
                ))}
                <small>
                  Получено {displayTime(e.received_at)} ·{" "}
                  {e.recorder.startsWith("user:")
                    ? "записано пользователем"
                    : e.recorder === "legacy"
                      ? "автор не зафиксирован"
                      : `добавлено: ${e.recorder}`}
                </small>
                {e.corrects_event_id && (
                  <small>Исправляет событие #{e.corrects_event_id}</small>
                )}
                {e.source_url && (
                  <a href={e.source_url} target="_blank" rel="noreferrer">
                    Источник ↗
                  </a>
                )}
              </article>
            ))
          ) : (
            <p>Событий этого типа пока нет.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const TaskDetails = memo(function TaskDetails({ taskId }: { taskId: number }) {
  const [historyOpen, setHistoryOpen] = useState(false),
    [jira, setJira] = useState<JiraSnapshot | null>(null),
    [metrics, setMetrics] = useState<StageMetrics | null>(null),
    [error, setError] = useState("");
  const [jiraKey, setJiraKey] = useState(""),
    [jiraUrl, setJiraUrl] = useState(""),
    [busy, setBusy] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const stateKey = useRefKey();
  const load = useCallback(async () => {
    try {
      const t = await request<{ jira: JiraSnapshot | null }>(`/tasks/${taskId}`);
      setJira(t.jira);
      setJiraKey(t.jira?.issue_key || "");
      setJiraUrl(t.jira?.url || "");
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }, [taskId]);
  useEffect(() => {
    void load();
  }, [load]);
  const loadStages = useCallback(async () => {
    try { setMetrics(await request<StageMetrics>(`/tasks/${taskId}/stages`)); }
    catch (e) { setError(errorText(e)); }
  }, [taskId]);
  useEffect(() => { if (stagesOpen) void loadStages(); }, [stagesOpen, loadStages]);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
      if (stagesOpen) await loadStages();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="task-details">
      <button
        type="button"
        className="history-button"
        onClick={() => setHistoryOpen(true)}
      >
        История изменений ↗
      </button>
      <TaskHistory
        taskId={taskId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      {error && (
        <p role="alert" className="tracker-error">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            Повторить
          </button>
        </p>
      )}
      <details>
        <summary>Jira · {jira?.issue_key || "не связана"}</summary>
        {jira && (
          <div className="detail-facts">
            <a href={jira.url} target="_blank" rel="noreferrer">
              {jira.issue_key} ↗
            </a>
            <span>Статус в Jira: {jira.status || "Снимок ещё не получен"}</span>
            <span>
              Исполнитель в Jira:{" "}
              {jira.checked_at ? jira.assignee || "Не назначен" : "Неизвестен"}
            </span>
            <span>
              Снимок:{" "}
              {jira.checked_at ? displayTime(jira.checked_at) : "не получен"}
              {jira.checked_at &&
              Date.now() - new Date(jira.checked_at).getTime() > 1200000
                ? " · данные могут быть устаревшими"
                : ""}
            </span>
            <span>
              История:{" "}
              {jira.history_complete
                ? "полная по данным агента"
                : "может быть неполной"}
            </span>
            {jira.error && <span>{jira.error}</span>}
          </div>
        )}
        <div className="form-grid">
          <label>
            Ключ Jira
            <input
              value={jiraKey}
              onChange={(e) => setJiraKey(e.target.value)}
              placeholder="ECHD-12345"
            />
          </label>
          <label>
            Ссылка Jira
            <input
              type="url"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !jiraKey || !jiraUrl}
          onClick={() =>
            void action(() =>
              request(`/tasks/${taskId}/jira`, {
                method: "PUT",
                body: JSON.stringify({ issue_key: jiraKey, url: jiraUrl }),
              }),
            )
          }
        >
          Сохранить связь
        </button>
        <button type="button" onClick={() => void load()}>
          Обновить полученные данные
        </button>
      </details>
      <details onToggle={e => setStagesOpen(e.currentTarget.open)}>
        <summary>Время в этапах{metrics?.paused ? " · на паузе" : ""}</summary>
        {metrics ? (
          <>
            <div className="metric-grid">
              <span>
                Очередь<b>{displayDays(metrics.totals.queue)}</b>
              </span>
              <span>
                Активные этапы<b>{displayDays(metrics.totals.active)}</b>
              </span>
              <span>
                Ожидание<b>{displayDays(metrics.totals.waiting)}</b>
              </span>
              <span>
                Пауза<b>{displayDays(metrics.totals.paused)}</b>
              </span>
              <span>
                Общий возраст<b>{displayDays(metrics.ageMilliseconds)}</b>
              </span>
            </div>
            <p>
              Первый известный вход в работу: {displayTime(metrics.firstActive)}
              <br />
              Первый известный вход в разработку:{" "}
              {displayTime(metrics.firstDevelopment)}
              <br />
              Текущий этап с: {displayTime(metrics.currentSince)}
              <br />
              До первого входа в работу:{" "}
              {displayDays(metrics.beforeFirstActiveMilliseconds)}
            </p>
            {Object.entries(metrics.stages).map(([s, v]) => (
              <p key={s}>
                {s}: {displayDays(v.milliseconds)} · заходов {v.entries}
              </p>
            ))}
            <label>
              {metrics.paused ? "Причина возобновления" : "Причина паузы"}
              <input
                value={pauseReason}
                onChange={(e) => {
                  setPauseReason(e.target.value);
                  stateKey.reset();
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy || !pauseReason.trim()}
              onClick={() =>
                void action(async () => {
                  await request(`/tasks/${taskId}/events`, {
                    method: "POST",
                    body: JSON.stringify({
                      event: {
                        external_id: stateKey.key,
                        type: metrics.paused ? "task.resumed" : "task.paused",
                        summary: pauseReason,
                        occurred_at: stateKey.at,
                      },
                    }),
                  });
                  stateKey.reset();
                  setPauseReason("");
                })
              }
            >
              {metrics.paused ? "Возобновить" : "Поставить на паузу"}
            </button>
          </>
        ) : (
          <p>Нет данных для расчёта.</p>
        )}
      </details>
      <ApprovedDocument taskId={taskId} />
    </div>
  );
});

function useRefKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const time = useRef<string | null>(null);
  return {
    key,
    get at() {
      return (time.current ??= new Date().toISOString());
    },
    reset: () => {
      time.current = null;
      setKey(crypto.randomUUID());
    },
  };
}
