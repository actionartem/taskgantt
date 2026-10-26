"use client";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { UserRound, Pencil, ExternalLink } from "lucide-react";
import { useApp } from "@/contexts/app-context";
import { request } from "@/lib/api";
import {
  STATUS_COLORS,
  type Task,
  type TaskStatus,
  type GroupBy,
} from "@/lib/types";
import type { JiraSnapshot } from "@/lib/tracker-types";
import { DocumentsView, AttentionView } from "./tracker-views";
import { HoursView } from "./hours-view";
import { buildGanttCalendar } from "@/lib/gantt-calendar";
import { GanttCalendarHeader } from "./gantt-calendar-header";
import { russianCalendarDay } from "@/lib/russian-calendar";
import { STATUS_TONES } from "@/lib/tracker-presentation";

const colors = STATUS_TONES;
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
  moved: boolean;
};
export const TrackerWorkspace = memo(function TrackerWorkspace({
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
    [statuses, setStatuses] = useState<TaskStatus[] | null>(null),
    [assignee, setAssignee] = useState(""),
    [priority, setPriority] = useState(""),
    [tag, setTag] = useState("");
  const [jiraStatus, setJiraStatus] = useState(""),
    [jiraAssignee, setJiraAssignee] = useState(""),
    [showJira, setShowJira] = useState(false),
    [jira, setJira] = useState<JiraSnapshot[]>([]);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === "undefined" ? 1440 : window.innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [width, setWidth] = useState(() => { if (typeof window === "undefined") return 640; const saved = Number(localStorage.getItem("st_list_width")); return saved >= 320 && saved <= 3000 ? saved : 640; }),
    [scale, setScale] = useState<"day" | "week" | "month">("day"),
    [filtersOpen, setFiltersOpen] = useState(false);
  const resizing = useRef<{ x: number; width: number; next: number } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const resizeFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(resizeFrame.current), []);
  useEffect(() => {
    const saved = Number(localStorage.getItem("st_list_width"));
    if (saved >= 320 && saved <= 3000) setWidth(saved);
  }, []);
  const changeWidth = (value: number) => {
    const next = Math.max(320, Math.min(value, viewportWidth - 280));
    setWidth(next);
    localStorage.setItem("st_list_width", String(next));
  };
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
  const suppressBarClick = useRef(false);
  useEffect(() => {
    let live = true;
    request<{ items: JiraSnapshot[] }>("/jira")
      .then((r) => {
        if (live) setJira(prev => JSON.stringify(prev) === JSON.stringify(r.items) ? prev : r.items);
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
          (statuses === null || statuses.includes(t.status)) &&
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
      }).sort((a, b) => Number(a.status === "завершена") - Number(b.status === "завершена") ||
        (a.startDate || "9999").localeCompare(b.startDate || "9999") || a.id - b.id),
    [
      tasks,
      search,
      statuses,
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
    visible.filter(t => t.status !== "завершена").forEach((t) => {
      const key =
        groupBy === "status"
          ? t.status
          : groupBy === "priority"
            ? t.priority
            : settings.executors.find((e) => e.id === t.assigneeId)?.name ||
              "Без исполнителя";
      groups.set(key, [...(groups.get(key) || []), t]);
    });
    const completed = visible.filter(t => t.status === "завершена");
    if (completed.length) groups.set("Завершённые", completed);
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
  const listWidth = Math.min(width, Math.max(320, viewportWidth - 280));
  const initialScroll = useRef(false);
  const previousAxis = useRef<{ start: number; cell: number; mobileView: string; scrollLeft: number } | null>(null);
  const count = range.end - range.start + 1,
    effectiveScale = count > 1500 && scale === "day" ? "week" : scale,
    cell = effectiveScale === "day" ? 30 : effectiveScale === "week" ? 9 : 3,
    timelineWidth = count * cell;
  useLayoutEffect(() => {
    if (view !== "tasks") { initialScroll.current = false; previousAxis.current = null; return; }
    const element = scroll.current;
    if (!element) return;
    if (tasks.length && !initialScroll.current && scroll.current) {
      scroll.current.scrollLeft = Math.max(0, (today - range.start - (viewportWidth < 768 ? 1 : 7)) * cell);
      initialScroll.current = true;
    } else if (previousAxis.current && (previousAxis.current.start !== range.start || previousAxis.current.cell !== cell)) {
      const anchor = previousAxis.current.start + previousAxis.current.scrollLeft / previousAxis.current.cell;
      element.scrollLeft = Math.max(0, (anchor - range.start) * cell);
    }
    if (viewportWidth < 768 && mobileView === "gantt" && previousAxis.current?.mobileView !== mobileView && scroll.current) {
      scroll.current.scrollLeft = Math.max(0, (today - range.start - 1) * cell);
    }
    previousAxis.current = { start: range.start, cell, mobileView, scrollLeft: element.scrollLeft };
  }, [tasks.length, today, range.start, cell, view, mobileView, viewportWidth]);
  const calendar = useMemo(() => buildGanttCalendar(range, cell, effectiveScale, today, russianCalendarDay), [range, cell, effectiveScale, today]);
  const gridStyle: CSSProperties = {
    width: timelineWidth,
    "--day-width": `${cell}px`,
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
    if (e.button !== 0 || !e.isPrimary || !canEdit || !task.startDate || !task.endDate || saving) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: task.id,
      x: e.clientX,
      start: day(task.startDate),
      end: day(task.endDate),
      mode,
      moved: false,
    };
    suppressBarClick.current = mode !== "move";
    setSelected(task.id);
  };
  const moveDrag = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) >= 4) {
      d.moved = true;
      suppressBarClick.current = true;
    }
    if (!d.moved) return;
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
  const openTask = (t: Task) => {
    onEdit(t);
  };
  const filterCount = [
    search,
    statuses === null ? "" : "statuses",
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
            src="/favicon_cat_128.png"
            alt="Кот-клоун SimpleTracker"
            width={64}
            height={64}
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
          {view === "tasks" ? visible.length : tasks.length} из {tasks.length} задач
        </div>
        <div className="header-actions">
          <button onClick={onExport}>Excel</button>
          <button onClick={onSettings}>Настройки</button>
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
          {view === "tasks" && <>
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
                  aria-pressed={effectiveScale === s}
                  onClick={() => setScale(s)}
                >
                  {["Дни", "Недели", "Месяцы"][i]}
                </button>
              ))}
            </div>
            <div className="filter-second-line">
              <label>
                <input
                  type="checkbox"
                  checked={showJira}
                  onChange={(e) => setShowJira(e.target.checked)}
                />{" "}
                Поля Jira
              </label>
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
                    setStatuses(null);
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
              </div>
            )}
          </section>
          <div className="status-filters" role="group" aria-label="Показать задачи по статусам">
            <button aria-pressed={statuses === null} onClick={() => setStatuses(null)}>Все</button>
            {(Object.keys(colors) as TaskStatus[]).map((s) => (
              <button key={s} aria-pressed={statuses === null || statuses.includes(s)}
                style={{ "--status": colors[s] } as CSSProperties}
                onClick={() => setStatuses((prev) => prev === null ? [s] : prev.includes(s) ? (prev.length === 1 ? null : prev.filter((v) => v !== s)) : [...prev, s])}>
                <i aria-hidden="true" />{s}
              </button>
            ))}
          </div>
          </>}
          {view === "hours" ? (
            <HoursView tasks={tasks} onOpenTask={openTask} />
          ) : (
            <div className="tracker-board" ref={board} style={{ "--list-width": `${listWidth}px`, "--calendar-off": calendar.background } as CSSProperties}>
            <div
              ref={scroll}
              onScroll={(e) => { if (previousAxis.current) previousAxis.current.scrollLeft = e.currentTarget.scrollLeft; }}
              className={`tracker-grid mobile-${mobileView} ${listWidth < 600 ? "narrow-list" : ""}`}
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
                    </div>
                    <GanttCalendarHeader calendar={calendar} width={timelineWidth} scroll={scroll} />
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
                      j = jiraMap.get(task.id),
                      jiraUrl = /^https?:\/\//i.test(j?.url || task.link || "") ? (j?.url || task.link)! : undefined;
                    return (
                      <div
                        className={`tracker-row ${selected === task.id ? "selected" : ""} ${showJira ? "with-jira" : ""}`}
                        key={task.id}
                      >
                        <div className="task-side">
                          <a
                            className="task-id"
                            href={jiraUrl} target="_blank" rel="noopener noreferrer"
                            aria-label={`Открыть задачу ${task.id} в Jira`}
                            aria-disabled={!jiraUrl} title={jiraUrl ? "Открыть в Jira" : "Ссылка на Jira не указана"}
                          >
                            {task.id}
                          </a>
                          <a
                            className="task-title"
                            href={jiraUrl} target="_blank" rel="noopener noreferrer"
                            aria-disabled={!jiraUrl}
                            title={`${task.title} · ${jiraUrl ? "Открыть в Jira" : "Ссылка на Jira не указана"}`}
                          >
                            {task.title}
                            {showJira && (
                              <small>
                                {j
                                  ? `${j.issue_key} · ${j.status || "нет снимка"} · ${j.checked_at ? j.assignee || "не назначен" : "не загружено"}`
                                  : "Jira не связана"}
                              </small>
                            )}
                          </a>
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
                          <button
                            className="edit-task-button"
                            aria-label={`Редактировать задачу ${task.id}`}
                            title="Редактировать карточку"
                            onClick={() => openTask(task)}
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                        <div className="task-timeline" style={gridStyle}>
                          {barWidth > 0 ? (
                            <>
                              <div
                                className="gantt-bar"
                                role="button"
                                tabIndex={canEdit && !saving ? 0 : -1}
                                aria-label={`Редактировать задачу ${task.id} на Ганте`}
                                aria-disabled={!canEdit || saving}
                                style={{
                                  left,
                                  width: barWidth,
                                  background: colors[task.status],
                                  color: task.status === "разработка" ? "#fff" : "#24231f",
                                }}
                                onPointerDown={(e) =>
                                  startDrag(e, task, "move")
                                }
                                onPointerMove={moveDrag}
                                onPointerUp={(e) => {
                                  const d = drag.current;
                                  if (d) suppressBarClick.current = d.mode !== "move" || d.moved || Math.abs(e.clientX - d.x) >= 4;
                                  drag.current = null;
                                }}
                                onPointerCancel={() => {
                                  drag.current = null;
                                  suppressBarClick.current = true;
                                  setPending(null);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (suppressBarClick.current) { suppressBarClick.current = false; return; }
                                  if (canEdit && !saving) openTask(task);
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === "Enter" || e.key === " ") && canEdit && !saving) {
                                    e.preventDefault();
                                    openTask(task);
                                  }
                                }}
                                title={`${task.title}: ${start} → ${end}`}
                              >
                                <span className="gantt-bar-label">{task.title}</span>
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
                              <a className="bar-jira-link" href={jiraUrl} target="_blank" rel="noopener noreferrer"
                                aria-label={`Открыть задачу ${task.id} в Jira из Ганта`} aria-disabled={!jiraUrl}
                                title={jiraUrl ? "Открыть в Jira" : "Ссылка на Jira не указана"}
                                style={{ left: left + barWidth + 4 }}>
                                <ExternalLink size={14} />
                              </a>
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
            <div className="list-divider" role="separator" tabIndex={0} aria-label="Ширина списка задач"
              aria-orientation="vertical" aria-valuemin={320} aria-valuemax={Math.max(320, viewportWidth - 280)} aria-valuenow={listWidth}
              style={{ left: "calc(var(--list-width) - 4px)" }}
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); resizing.current = { x: e.clientX, width: listWidth, next: listWidth }; }}
              onPointerMove={(e) => { if (resizing.current) { resizing.current.next = Math.max(320, Math.min(resizing.current.width + e.clientX - resizing.current.x, viewportWidth - 280)); if (!resizeFrame.current) resizeFrame.current = requestAnimationFrame(() => { resizeFrame.current = 0; if (resizing.current) { board.current?.style.setProperty("--list-width", `${resizing.current.next}px`); scroll.current?.classList.toggle("narrow-list", resizing.current.next < 600); } }); } }}
              onPointerUp={() => { cancelAnimationFrame(resizeFrame.current); resizeFrame.current = 0; if (resizing.current) changeWidth(resizing.current.next); resizing.current = null; }}
              onPointerCancel={() => { cancelAnimationFrame(resizeFrame.current); resizeFrame.current = 0; board.current?.style.setProperty("--list-width", `${listWidth}px`); resizing.current = null; }}
              onKeyDown={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); changeWidth(e.key === "Home" ? 320 : e.key === "End" ? viewportWidth - 280 : listWidth + (e.key === "ArrowRight" ? 20 : -20)); } }}
            />
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
      </footer>
    </div>
  );
});
