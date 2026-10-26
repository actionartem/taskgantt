"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { Moon, Sun, UserRound, RefreshCw, EyeOff, Eye } from "lucide-react";
import { useApp } from "@/contexts/app-context";
import { request } from "@/lib/api";
import {
  STATUS_COLORS,
  type Task,
  type TaskStatus,
  type GroupBy,
} from "@/lib/types";
import type { JiraSnapshot } from "@/lib/tracker-types";
import { DocumentsView, AttentionView, HoursView } from "./tracker-views";

const colors: Record<TaskStatus, string> = {
  "не в работе": "#8B8579",
  "в аналитике": "#3E7FB0",
  "на согласовании": "#B07A0A",
  оценка: "#8A64B0",
  "готова к разработке": "#1F8F84",
  разработка: "#2B2723",
  ревью: "#B03F86",
  завершена: "#4C8A3C",
};
const day = (s: string) =>
  Math.floor(new Date(s.slice(0, 10) + "T00:00:00Z").getTime() / 86400000);
const ymd = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const short = (s?: string | null) =>
  s ? s.slice(8, 10) + "." + s.slice(5, 7) : "—";
const todayYmd = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(
    new Date(),
  );
type Props = {
  onCreate: () => void;
  onEdit: (t: Task) => void;
  onSettings: () => void;
  onExport: () => void;
  onProfile: () => void;
  canEdit: boolean;
};
type Drag = {
  id: number;
  x: number;
  start: number;
  end: number;
  mode: "move" | "start" | "end";
};
export function TrackerWorkspace({
  onCreate,
  onEdit,
  onSettings,
  onExport,
  onProfile,
  canEdit,
}: Props) {
  const {
    tasks,
    settings,
    theme,
    toggleTheme,
    groupBy,
    setGroupBy,
    updateTask,
    lastRefresh,
    refreshError,
    loading,
    refreshFromApi,
  } = useApp();
  const [view, setView] = useState<
      "tasks" | "documents" | "attention" | "hours"
    >("tasks"),
    [mobileView, setMobileView] = useState<"list" | "gantt">("list");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [assignee, setAssignee] = useState(""),
    [priority, setPriority] = useState(""),
    [tag, setTag] = useState("");
  const [jiraStatus, setJiraStatus] = useState(""),
    [jiraAssignee, setJiraAssignee] = useState(""),
    [showJira, setShowJira] = useState(false),
    [jira, setJira] = useState<JiraSnapshot[]>([]);
  const [viewportWidth, setViewportWidth] = useState(1440);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [width, setWidth] = useState(640),
    [scale, setScale] = useState<"day" | "week" | "month">("day"),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState<{
      id: number;
      startDate: string;
      endDate: string;
    } | null>(null),
    [saving, setSaving] = useState(false);
  const drag = useRef<Drag | null>(null),
    scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    request<{ items: JiraSnapshot[] }>("/jira")
      .then((r) => {
        if (live) setJira(r.items);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [lastRefresh]);
  const jiraMap = useMemo(
    () => new Map(jira.map((j) => [Number(j.task_id), j])),
    [jira],
  );
  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        const j = jiraMap.get(t.id);
        return (
          (!search ||
            `${t.id} ${t.title} ${t.tags.join(" ")} ${j?.issue_key || ""}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!status || t.status === status) &&
          (!assignee ||
            (assignee === "none"
              ? !t.assigneeId
              : String(t.assigneeId) === assignee)) &&
          (!priority || t.priority === priority) &&
          (!tag || t.tags.includes(tag)) &&
          (!jiraStatus || j?.status === jiraStatus) &&
          (!jiraAssignee ||
            (jiraAssignee === "none"
              ? !!j?.checked_at && !j.assignee
              : j?.assignee === jiraAssignee))
        );
      }),
    [
      tasks,
      search,
      status,
      assignee,
      priority,
      tag,
      jiraStatus,
      jiraAssignee,
      jiraMap,
    ],
  );
  const rows = useMemo(() => {
    if (groupBy === "none") return visible.map((task) => ({ task, group: "" }));
    const groups = new Map<string, Task[]>();
    visible.forEach((t) => {
      const key =
        groupBy === "status"
          ? t.status
          : groupBy === "priority"
            ? t.priority
            : settings.executors.find((e) => e.id === t.assigneeId)?.name ||
              "Без исполнителя";
      groups.set(key, [...(groups.get(key) || []), t]);
    });
    return [...groups].flatMap(([group, items]) => [
      { group: `${group} · ${items.length}`, task: null as Task | null },
      ...items.map((task) => ({ task, group: "" })),
    ]);
  }, [visible, groupBy, settings.executors]);
  const today = day(todayYmd()),
    range = useMemo(() => {
      const dates = visible.flatMap((t) =>
        [t.startDate, t.endDate].filter(Boolean).map((s) => day(s!)),
      );
      return {
        start: Math.min(today - 14, ...dates) - 3,
        end: Math.max(today + 30, ...dates) + 4,
      };
    }, [visible, today]);
  const listWidth = Math.min(width, Math.max(380, viewportWidth - 380));
  const initialScroll = useRef(false);
  const count = range.end - range.start + 1,
    effectiveScale = count > 1500 && scale === "day" ? "week" : scale,
    cell = effectiveScale === "day" ? 30 : effectiveScale === "week" ? 9 : 3,
    timelineWidth = count * cell;
  useEffect(() => {
    if (tasks.length && !initialScroll.current && scroll.current) {
      scroll.current.scrollLeft = Math.max(0, (today - range.start - 7) * cell);
      initialScroll.current = true;
    }
  }, [tasks.length, today, range.start, cell]);
  const calendar = useMemo(() => {
    const months: Array<{ label: string; left: number; width: number }> = [],
      ticks: Array<{
        label: string;
        sub: string;
        left: number;
        width: number;
        today: boolean;
      }> = [];
    for (let d = range.start; d <= range.end; d++) {
      const dt = new Date(d * 86400000),
        label = dt.toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
      if (months.at(-1)?.label === label)
        months[months.length - 1].width += cell;
      else months.push({ label, left: (d - range.start) * cell, width: cell });
      if (
        effectiveScale === "day" ||
        (effectiveScale === "week" && dt.getUTCDay() === 1) ||
        (effectiveScale === "month" && dt.getUTCDate() === 1)
      )
        ticks.push({
          label: String(dt.getUTCDate()),
          sub:
            effectiveScale === "day"
              ? dt.toLocaleDateString("ru-RU", {
                  weekday: "short",
                  timeZone: "UTC",
                })
              : short(ymd(d)),
          left: (d - range.start) * cell,
          width:
            effectiveScale === "day"
              ? cell
              : effectiveScale === "week"
                ? 7 * cell
                : 28 * cell,
          today: d === today,
        });
    }
    return { months, ticks };
  }, [range, cell, effectiveScale, today]);
  const gridStyle: CSSProperties = {
    width: timelineWidth,
    "--day-width": `${cell}px`,
    "--week-offset": `${((6 - new Date(range.start * 86400000).getUTCDay() + 7) % 7) * cell}px`,
    "--today-x": `${(today - range.start) * cell}px`,
  } as CSSProperties;
  const doAction = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  };
  const startDrag = (e: PointerEvent, task: Task, mode: Drag["mode"]) => {
    if (!canEdit || !task.startDate || !task.endDate || saving) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: task.id,
      x: e.clientX,
      start: day(task.startDate),
      end: day(task.endDate),
      mode,
    };
    setSelected(task.id);
  };
  const moveDrag = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.x) / cell);
    const start =
      d.mode === "end"
        ? d.start
        : d.mode === "start"
          ? Math.min(d.start + delta, d.end)
          : d.start + delta;
    const end =
      d.mode === "start"
        ? d.end
        : d.mode === "end"
          ? Math.max(d.end + delta, d.start)
          : d.end + delta;
    if (delta || pending)
      setPending({ id: d.id, startDate: ymd(start), endDate: ymd(end) });
  };
  const applyDates = async () => {
    if (!pending) return;
    setSaving(true);
    await doAction(async () => {
      await updateTask(pending.id, {
        startDate: pending.startDate,
        endDate: pending.endDate,
      });
      setPending(null);
    });
    setSaving(false);
  };
  const totals = visible.reduce(
    (a, t) => ({
      approved: a.approved + (t.approvedHours || 0),
      spent: a.spent + (t.spentHours || 0),
      noApproved: a.noApproved + Number(t.approvedHours == null),
      noSpent: a.noSpent + Number(t.spentHours == null),
    }),
    { approved: 0, spent: 0, noApproved: 0, noSpent: 0 },
  );
  const openTask = (t: Task) => {
    setSelected(t.id);
    onEdit(t);
  };
  const filterCount = [
    search,
    status,
    assignee,
    priority,
    tag,
    jiraStatus,
    jiraAssignee,
  ].filter(Boolean).length;
  return (
    <div className={`tracker-frame ${view === "hours" ? "hours-mode" : ""}`}>
      <header className="tracker-header">
        <div className="brand-cat">
          <img
            src="/favicon_cat_64.png"
            alt="Кот-клоун SimpleTracker"
            width={52}
            height={52}
          />
        </div>
        <div className="brand-name">
          Simple
          <br />
          Tracker
        </div>
        <h1>
          {view === "tasks"
            ? "Задачи"
            : view === "documents"
              ? "Документы"
              : view === "hours"
                ? "Часы"
                : "Внимание"}
        </h1>
        <div className="header-meta">
          {new Date().toLocaleDateString("ru-RU", {
            timeZone: "Europe/Moscow",
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
          <br />
          {visible.length} из {tasks.length} задач
        </div>
        <div className="header-actions">
          <button onClick={onExport}>Excel</button>
          <button onClick={onSettings}>Настройки</button>
          <button
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Тёмная тема" : "Светлая тема"}
            title="Переключить тему"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button onClick={onProfile} aria-label="Профиль">
            <UserRound size={18} />
          </button>
          <button
            className="accent-button"
            disabled={!canEdit}
            onClick={onCreate}
          >
            + Новая задача
          </button>
        </div>
      </header>
      <nav className="tracker-tabs" aria-label="Разделы">
        <button
          aria-current={view === "tasks" ? "page" : undefined}
          onClick={() => setView("tasks")}
        >
          Задачи и Гант
        </button>
        <button
          aria-current={view === "attention" ? "page" : undefined}
          onClick={() => setView("attention")}
        >
          Требует внимания
        </button>
        <button
          aria-current={view === "documents" ? "page" : undefined}
          onClick={() => setView("documents")}
        >
          Документы
        </button>
        <button
          aria-current={view === "hours" ? "page" : undefined}
          onClick={() => setView("hours")}
        >
          Часы
        </button>
      </nav>
      {refreshError && (
        <div role="alert" className="tracker-error">
          Данные могли устареть: {refreshError}{" "}
          <button onClick={() => void refreshFromApi().catch(() => {})}>
            Повторить
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="tracker-error">
          {error}
          <button onClick={() => setError("")}>Закрыть</button>
        </div>
      )}
      {view === "documents" ? (
        <DocumentsView
          onOpenTask={(id) => {
            const t = tasks.find((x) => x.id === id);
            if (t) openTask(t);
          }}
        />
      ) : view === "attention" ? (
        <AttentionView
          onOpenTask={(id) => {
            const t = tasks.find((x) => x.id === id);
            if (t) openTask(t);
          }}
        />
      ) : (
        <>
          <div className="mobile-controls">
            <button
              aria-pressed={mobileView === "list"}
              onClick={() => setMobileView("list")}
            >
              Список
            </button>
            <button
              aria-pressed={mobileView === "gantt"}
              onClick={() => setMobileView("gantt")}
            >
              Гант
            </button>
            <button onClick={() => setFiltersOpen((v) => !v)}>
              Фильтры {filterCount || ""}
            </button>
          </div>
          <section
            className={`tracker-filters ${filtersOpen ? "filters-open" : ""}`}
            aria-label="Фильтры задач"
          >
            <input
              aria-label="Поиск задач"
              placeholder="Поиск: номер, название, тег"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Статус"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Статус: все</option>
              {Object.keys(STATUS_COLORS).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Исполнитель"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Исполнитель: все</option>
              <option value="none">Не назначен</option>
              {settings.executors.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Приоритет"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">Приоритет: все</option>
              {["низкий", "средний", "высокий"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              aria-label="Тег"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">Тег: все</option>
              {settings.tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              aria-label="Группировка"
              className="gantt-only"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            >
              <option value="none">Без группировки</option>
              <option value="status">По статусу</option>
              <option value="assignee">По исполнителю</option>
              <option value="priority">По приоритету</option>
            </select>
            <div className="scale-control">
              {(["day", "week", "month"] as const).map((s, i) => (
                <button
                  key={s}
                  aria-pressed={scale === s}
                  onClick={() => setScale(s)}
                >
                  {["Дни", "Недели", "Месяцы"][i]}
                </button>
              ))}
            </div>
            <div className="filter-second-line">
              <label className="width-control">
                Ширина списка{" "}
                <input
                  aria-label="Ширина списка"
                  type="range"
                  min="380"
                  max="900"
                  step="20"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showJira}
                  onChange={(e) => setShowJira(e.target.checked)}
                />{" "}
                {view === "hours" ? "Фильтры Jira" : "Поля Jira"}
              </label>
              <span className="gantt-only">
                Скрыты из Ганта:{" "}
                {visible.filter((t) => t.hiddenFromGantt).length}
              </span>
              <button
                className="gantt-only"
                onClick={() =>
                  scroll.current?.scrollTo({
                    left: Math.max(0, (today - range.start) * cell - 60),
                    behavior: "instant",
                  })
                }
              >
                Сегодня
              </button>
              {filterCount > 0 && (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setAssignee("");
                    setPriority("");
                    setTag("");
                    setJiraStatus("");
                    setJiraAssignee("");
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
            {showJira && (
              <div className="filter-second-line">
                <select
                  aria-label="Статус Jira"
                  value={jiraStatus}
                  onChange={(e) => setJiraStatus(e.target.value)}
                >
                  <option value="">Jira: все статусы</option>
                  {[...new Set(jira.map((j) => j.status).filter(Boolean))].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
                <select
                  aria-label="Исполнитель Jira"
                  value={jiraAssignee}
                  onChange={(e) => setJiraAssignee(e.target.value)}
                >
                  <option value="">Jira: все исполнители</option>
                  <option value="none">Jira: не назначен</option>
                  {[
                    ...new Set(jira.map((j) => j.assignee).filter(Boolean)),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <span>
                  Снимки Jira передаёт агент; локальные поля независимы.
                </span>
              </div>
            )}
          </section>
          <div className="tracker-totals">
            <span>По фильтру:</span>
            <span>
              Согласовано: <b>{totals.approved.toLocaleString("ru-RU")} ч</b>
            </span>
            <span>
              Потрачено: <b>{totals.spent.toLocaleString("ru-RU")} ч</b>
            </span>
            <span className="muted">
              без оценки: {totals.noApproved} · без факта: {totals.noSpent}{" "}
              (неизвестно ≠ 0 ч)
            </span>
          </div>
          {view === "tasks" && count > 1500 && scale === "day" && (
            <p className="tracker-hint">
              Для длинного периода включён недельный масштаб. Даты задач не
              меняются.
            </p>
          )}
          {view === "hours" ? (
            <HoursView tasks={visible} onOpenTask={openTask} />
          ) : (
            <div
              ref={scroll}
              className={`tracker-grid mobile-${mobileView} ${listWidth < 600 ? "narrow-list" : ""}`}
              style={{ "--list-width": `${listWidth}px` } as CSSProperties}
            >
              {loading && !tasks.length ? (
                <p className="empty-state">Загружаю задачи…</p>
              ) : !visible.length ? (
                <p className="empty-state">
                  {tasks.length
                    ? "По этим фильтрам задач нет."
                    : "Задач пока нет. Создай первую задачу."}
                </p>
              ) : (
                <div
                  style={{
                    minWidth: `calc(var(--list-width) + ${timelineWidth}px)`,
                  }}
                  className="timeline-content"
                >
                  <div className="tracker-grid-head">
                    <div className="task-side task-head">
                      <span>ID</span>
                      <span>Задача</span>
                      <span>Статус</span>
                      <span className="row-date">Срок</span>
                    </div>
                    <div
                      className="timeline-head"
                      style={{ width: timelineWidth }}
                    >
                      <div className="calendar-months">
                        {calendar.months.map((m) => (
                          <span
                            key={m.label}
                            style={{ left: m.left, width: m.width }}
                          >
                            <b className="calendar-month-label">{m.label}</b>
                          </span>
                        ))}
                      </div>
                      <div className="calendar-ticks">
                        {calendar.ticks.map((t) => (
                          <span
                            key={t.left}
                            className={t.today ? "is-today" : ""}
                            style={{ left: t.left, width: t.width }}
                          >
                            {t.label}
                            <small>{t.today ? "сег" : t.sub}</small>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {rows.map((row, index) => {
                    const task = row.task;
                    if (!task)
                      return (
                        <div className="tracker-group" key={`g${index}`}>
                          <div className="task-side">{row.group}</div>
                          <div style={{ width: timelineWidth }} />
                        </div>
                      );
                    const start =
                        pending?.id === task.id
                          ? pending.startDate
                          : task.startDate,
                      end =
                        pending?.id === task.id
                          ? pending.endDate
                          : task.endDate;
                    const left = start ? (day(start) - range.start) * cell : 0,
                      barWidth =
                        start && end
                          ? Math.max(cell, (day(end) - day(start) + 1) * cell)
                          : 0,
                      j = jiraMap.get(task.id);
                    return (
                      <div
                        className={`tracker-row ${selected === task.id ? "selected" : ""} ${showJira ? "with-jira" : ""}`}
                        key={task.id}
                      >
                        <div className="task-side">
                          <button
                            className="task-id"
                            onClick={() => openTask(task)}
                          >
                            {task.id}
                          </button>
                          <button
                            className="task-title"
                            onClick={() => openTask(task)}
                            title={task.title}
                          >
                            {task.title}
                            {showJira && (
                              <small>
                                {j
                                  ? `${j.issue_key} · ${j.status || "нет снимка"} · ${j.checked_at ? j.assignee || "не назначен" : "не загружено"}`
                                  : "Jira не связана"}
                              </small>
                            )}
                          </button>
                          <select
                            aria-label={`Статус задачи ${task.id}`}
                            disabled={!canEdit}
                            value={task.status}
                            className="status-chip"
                            style={
                              {
                                "--status": colors[task.status],
                              } as CSSProperties
                            }
                            onChange={(e) =>
                              void doAction(() =>
                                updateTask(task.id, {
                                  status: e.target.value as TaskStatus,
                                }),
                              )
                            }
                          >
                            {Object.keys(STATUS_COLORS).map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                          <span
                            className="assignee-avatar"
                            title={
                              settings.executors.find(
                                (e) => e.id === task.assigneeId,
                              )?.name || "Не назначен"
                            }
                          >
                            {settings.executors
                              .find((e) => e.id === task.assigneeId)
                              ?.name.slice(0, 1) || "?"}
                          </span>
                          <span className="row-date">
                            {short(task.startDate)}–{short(task.endDate)}
                          </span>
                          <button
                            className="hide-button"
                            aria-label={`${task.hiddenFromGantt ? "Показать" : "Скрыть"} задачу ${task.id} в Ганте`}
                            onClick={() =>
                              void doAction(() =>
                                updateTask(task.id, {
                                  hiddenFromGantt: !task.hiddenFromGantt,
                                }),
                              )
                            }
                          >
                            {task.hiddenFromGantt ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                        </div>
                        <div className="task-timeline" style={gridStyle}>
                          {task.hiddenFromGantt ? (
                            <span className="timeline-note">
                              Скрыта из Ганта
                            </span>
                          ) : barWidth > 0 ? (
                            <>
                              <div
                                className="gantt-bar"
                                style={{
                                  left,
                                  width: barWidth,
                                  background: colors[task.status],
                                }}
                                onPointerDown={(e) =>
                                  startDrag(e, task, "move")
                                }
                                onPointerMove={moveDrag}
                                onPointerUp={() => {
                                  drag.current = null;
                                }}
                                onPointerCancel={() => {
                                  drag.current = null;
                                  setPending(null);
                                }}
                                onDoubleClick={() => openTask(task)}
                                title={`${task.title}: ${start} → ${end}`}
                              >
                                <span
                                  className="bar-handle left"
                                  onPointerDown={(e) =>
                                    startDrag(e, task, "start")
                                  }
                                />
                                <span
                                  className="bar-handle right"
                                  onPointerDown={(e) =>
                                    startDrag(e, task, "end")
                                  }
                                />
                              </div>
                              <button
                                className="bar-date"
                                style={
                                  left + barWidth + 130 > timelineWidth
                                    ? {
                                        right: Math.max(
                                          0,
                                          timelineWidth - left + 6,
                                        ),
                                      }
                                    : { left: left + barWidth + 6 }
                                }
                                onClick={() => openTask(task)}
                              >
                                {short(start)} → {short(end)}
                              </button>
                            </>
                          ) : (
                            <button
                              className="timeline-note"
                              onClick={() => openTask(task)}
                            >
                              Задать даты
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {view === "tasks" && pending && (
            <div className="pending-dates" role="status">
              #{pending.id} · {short(pending.startDate)} →{" "}
              {short(pending.endDate)}
              <button
                disabled={saving}
                className="accent-button"
                onClick={() => void applyDates()}
              >
                {saving ? "Сохраняю…" : "Применить"}
              </button>
              <button disabled={saving} onClick={() => setPending(null)}>
                Отменить
              </button>
            </div>
          )}
        </>
      )}
      <footer className="tracker-footer">
        <span>
          {loading
            ? "Обновляю…"
            : lastRefresh
              ? `Данные: ${new Date(lastRefresh).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow" })} МСК`
              : "Данные ещё не загружены"}
        </span>
        <button
          onClick={() => void refreshFromApi().catch(() => {})}
          disabled={loading}
        >
          <RefreshCw size={13} /> Обновить
        </button>
        <span>Telegram выключен</span>
      </footer>
    </div>
  );
}
