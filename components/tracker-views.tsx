"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { request, downloadDocument } from "@/lib/api";
import { useApp } from "@/contexts/app-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DOCUMENT_KINDS,
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
function DownloadLink({ doc }: { doc: TaskDocument }) {
  const [error, setError] = useState("");
  return (
    <>
      {doc.file_size ? (
        <button
          type="button"
          onClick={() =>
            void downloadDocument(doc).catch((e) => setError(errorText(e)))
          }
        >
          Скачать
        </button>
      ) : doc.source_url ? (
        <a href={doc.source_url} target="_blank" rel="noreferrer">
          Открыть источник ↗
        </a>
      ) : null}
      {error && (
        <span role="alert" className="tracker-error">
          {error}
        </span>
      )}
    </>
  );
}
export function DocumentsView({
  onOpenTask,
}: {
  onOpenTask: (id: number) => void;
}) {
  const [docs, setDocs] = useState<TaskDocument[]>([]),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState(""),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const { tasks, lastRefresh } = useApp();
  useEffect(() => {
    let live = true;
    setLoading(true);
    request<TaskDocument[]>("/documents")
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
      (!kind || d.kind === kind) &&
      (!filter || (filter === "current" ? d.is_current : !!d.approved_at)) &&
      `${d.task_id} ${tasks.find((t) => t.id === Number(d.task_id))?.title || ""} ${d.title} ${d.version}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="tracker-section">
      <div className="section-tools">
        <input
          placeholder="Задача, название, версия"
          aria-label="Поиск документов"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Вид документа"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">Все виды</option>
          {Object.entries(DOCUMENT_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Состояние документа"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Все версии</option>
          <option value="current">Актуальные</option>
          <option value="approved">Согласованные</option>
        </select>
      </div>
      <p className="muted">
        Актуальная версия и согласованная версия могут отличаться. Новая
        загрузка не наследует согласование.
      </p>
      {error && (
        <p role="alert" className="tracker-error">
          {error}
        </p>
      )}
      {loading ? (
        <p>Загружаю документы…</p>
      ) : visible.length ? (
        visible.map((d) => (
          <article className="document-row" key={d.id}>
            <button onClick={() => onOpenTask(Number(d.task_id))}>
              #{d.task_id}
            </button>
            <div>
              <b>
                {DOCUMENT_KINDS[d.kind]} · {d.title} · v{d.version}
              </b>
              <small>
                Получен {displayTime(d.received_at)} ·{" "}
                {d.document_date
                  ? `Дата документа: ${d.document_date.slice(0, 10)}`
                  : "Дата документа неизвестна"}
              </small>
            </div>
            <span>
              {d.is_current ? "Актуальная" : "Актуальность не подтверждена"}
              <small>
                {d.approved_at
                  ? `Согласована ${displayTime(d.approved_at)}`
                  : "Согласование не подтверждено"}
              </small>
            </span>
            <DownloadLink doc={d} />
          </article>
        ))
      ) : (
        <p className="empty-state">
          Документов по этим условиям нет. Версии можно добавить в карточке
          задачи или через API агента.
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
      <p className="muted">
        Только подтверждённые сроки, активные задачи и заданные действия.
        Возраст очереди сам по себе не создаёт сигнал.
      </p>
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
      {loading ? (
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
            <DialogDescription>
              Срок задачи останется прежним. Новые причины будут показаны
              отдельно.
            </DialogDescription>
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
          <DialogDescription>
            Время указано по Москве. Участник внешнего события — по сведениям
            источника.
          </DialogDescription>
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

export function TaskDetails({ taskId }: { taskId: number }) {
  const [historyOpen, setHistoryOpen] = useState(false),
    [docs, setDocs] = useState<TaskDocument[]>([]),
    [jira, setJira] = useState<JiraSnapshot | null>(null),
    [metrics, setMetrics] = useState<StageMetrics | null>(null),
    [error, setError] = useState("");
  const [jiraKey, setJiraKey] = useState(""),
    [jiraUrl, setJiraUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [upload, setUpload] = useState(false);
  const [kind, setKind] = useState("az"),
    [title, setTitle] = useState(""),
    [version, setVersion] = useState(""),
    [docDate, setDocDate] = useState(""),
    [link, setLink] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const [mark, setMark] = useState<TaskDocument | null>(null),
    [evidence, setEvidence] = useState(""),
    [approvedAt, setApprovedAt] = useState("");
  const uploadKey = useRefKey();
  const approvalKey = useRefKey();
  const currentRequests = useRef<Record<string, { id: string; at: string }>>(
    {},
  );
  const [pauseReason, setPauseReason] = useState("");
  const stateKey = useRefKey();
  const load = useCallback(async () => {
    try {
      const [t, d, m] = await Promise.all([
        request<{ jira: JiraSnapshot | null }>(`/tasks/${taskId}`),
        request<TaskDocument[]>(`/tasks/${taskId}/documents`),
        request<StageMetrics>(`/tasks/${taskId}/stages`),
      ]);
      setJira(t.jira);
      setJiraKey(t.jira?.issue_key || "");
      setJiraUrl(t.jira?.url || "");
      setDocs(d);
      setMetrics(m);
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }, [taskId]);
  useEffect(() => {
    void load();
  }, [load]);
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
  const register = async () => {
    let file_base64: string | undefined;
    if (file) {
      if (file.size > 10485760)
        throw new Error("Максимальный размер файла — 10 МБ");
      file_base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    await request(`/tasks/${taskId}/documents`, {
      method: "POST",
      body: JSON.stringify({
        event: {
          external_id: uploadKey.key,
          type: "document.received",
          summary: `Добавлен ${DOCUMENT_KINDS[kind as keyof typeof DOCUMENT_KINDS]} ${title} v${version}`,
          occurred_at: uploadKey.at,
        },
        document: {
          kind,
          title,
          version,
          document_date: docDate || null,
          source_url: link || null,
          file_name: file?.name,
          file_base64,
        },
      }),
    });
    setUpload(false);
    uploadKey.reset();
    setFile(null);
    setTitle("");
    setVersion("");
    setLink("");
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
        <p className="muted">
          Данные и историю передаёт агент. Локальные статус и ответственный
          сохраняются отдельно.
        </p>
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
      <details>
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
            <p className="muted">
              Календарное время по статусам SimpleTracker, не трудозатраты.
              Паузы исключены из длительностей этапов.{" "}
              {metrics.complete
                ? "История известна с создания задачи."
                : `История неполная. Известно с ${displayTime(metrics.observedSince)}; неизвестные интервалы в суммы не включены.`}
            </p>
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
      <details open>
        <summary>Документы · {docs.length}</summary>
        {docs.map((d) => (
          <article className="document-compact" key={d.id}>
            <b>
              {DOCUMENT_KINDS[d.kind]} · {d.title} · v{d.version}
            </b>
            <small>
              {d.is_current ? "Актуальная" : "Актуальность не подтверждена"} ·{" "}
              {d.approved_at
                ? `Согласована ${displayTime(d.approved_at)}`
                : "Согласование не подтверждено"}
            </small>
            <div className="section-tools">
              <DownloadLink doc={d} />
              {!d.is_current && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const pending = (currentRequests.current[d.id] ??= {
                        id: crypto.randomUUID(),
                        at: new Date().toISOString(),
                      });
                      await request(
                        `/tasks/${taskId}/documents/${d.id}/state`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            event: {
                              external_id: pending.id,
                              type: "document.current",
                              summary: `Рабочая версия: ${d.title} v${d.version}`,
                              occurred_at: pending.at,
                            },
                            state: { is_current: true },
                          }),
                        },
                      );
                      delete currentRequests.current[d.id];
                    })
                  }
                >
                  Сделать актуальной
                </button>
              )}
              {!d.approved_at && (
                <button
                  type="button"
                  onClick={() => {
                    setMark(d);
                    approvalKey.reset();
                    setEvidence("");
                    setApprovedAt("");
                  }}
                >
                  Зафиксировать согласование
                </button>
              )}
            </div>
          </article>
        ))}
        {!docs.length && (
          <p className="muted">
            Подтверждённых версий пока нет. Прежний текст истории остаётся в
            поле выше.
          </p>
        )}
        <button type="button" onClick={() => setUpload((v) => !v)}>
          Добавить версию
        </button>
        {upload && (
          <div className="document-upload form-grid">
            <label>
              Вид
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  uploadKey.reset();
                }}
              >
                {Object.entries(DOCUMENT_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Версия
              <input
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                  uploadKey.reset();
                }}
              />
            </label>
            <label>
              Название
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  uploadKey.reset();
                }}
              />
            </label>
            <label>
              Дата документа
              <input
                type="date"
                value={docDate}
                onChange={(e) => {
                  setDocDate(e.target.value);
                  uploadKey.reset();
                }}
              />
            </label>
            <label>
              Ссылка на источник
              <input
                type="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  uploadKey.reset();
                }}
              />
            </label>
            <label>
              Файл · до 10 МБ
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  uploadKey.reset();
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy || !title || !version || (!file && !link)}
              onClick={() => void action(register)}
            >
              {busy ? "Сохраняю…" : "Сохранить версию"}
            </button>
          </div>
        )}
        {mark && (
          <div className="document-upload">
            <b>
              Согласование {mark.title} v{mark.version}
            </b>
            <label>
              Когда согласовано
              <input
                type="datetime-local"
                value={approvedAt}
                onChange={(e) => {
                  setApprovedAt(e.target.value);
                  approvalKey.reset();
                }}
              />
            </label>
            <label>
              Основание: ссылка или описание подтверждения
              <textarea
                value={evidence}
                onChange={(e) => {
                  setEvidence(e.target.value);
                  approvalKey.reset();
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy || !evidence || !approvedAt}
              onClick={() =>
                void action(async () => {
                  await request(`/tasks/${taskId}/documents/${mark.id}/state`, {
                    method: "POST",
                    body: JSON.stringify({
                      event: {
                        external_id: approvalKey.key,
                        type: "document.approved",
                        summary: `Согласована ${mark.title} v${mark.version}`,
                        occurred_at: new Date(approvedAt).toISOString(),
                      },
                      state: {
                        approved_at: new Date(approvedAt).toISOString(),
                        approval_evidence: evidence,
                      },
                    }),
                  });
                  setMark(null);
                })
              }
            >
              Подтвердить согласование
            </button>
            <button type="button" onClick={() => setMark(null)}>
              Отмена
            </button>
          </div>
        )}
      </details>
    </div>
  );
}
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
