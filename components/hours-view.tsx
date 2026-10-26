"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { request } from "@/lib/api";
import { useApp } from "@/contexts/app-context";
import type { Task } from "@/lib/types";
import { inHoursPeriod } from "@/lib/tracker-presentation";

type Fact = { task_id: string; completed_on: string | null; planned_release_on: string | null };
type Row = { task: Task; date: string | null; done: boolean };
type Sort = "id" | "title" | "status" | "hours";
const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const number = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const tasksLabel = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? "задач" : n % 10 === 1 ? "задача" : n % 10 >= 2 && n % 10 <= 4 ? "задачи" : "задач"}`;
const summary = (rows: Row[]) => ({
  count: rows.length,
  hours: rows.reduce((sum, r) => sum + (r.task.approvedHours ?? 0), 0),
  unknown: rows.filter(r => r.task.approvedHours == null).length,
});
export function HoursView({ tasks, onOpenTask }: { tasks: Task[]; onOpenTask: (t: Task) => void }) {
  const { lastRefresh } = useApp();
  const currentYear = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", year: "numeric" }).format(new Date());
  const [year, setYear] = useState("all");
  const [facts, setFacts] = useState<Fact[] | null>(null), [error, setError] = useState("");
  const [retry, setRetry] = useState(0), [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<"hours" | "count">("hours");
  const [sort, setSort] = useState<Sort>("hours"), [direction, setDirection] = useState<"asc" | "desc">("desc");
  useEffect(() => {
    let live = true;
    setLoading(true);
    request<{ items: Fact[] }>("/statistics/hours").then(r => {
      if (live) { setFacts(r.items); setError(""); }
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Не удалось загрузить даты"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [lastRefresh, retry]);
  const rows = useMemo<Row[]>(() => {
    const byId = new Map((facts || []).map(f => [Number(f.task_id), f]));
    return tasks.map(task => {
      const done = task.status === "завершена", fact = byId.get(task.id);
      return { task, done, date: (done ? fact?.completed_on : fact?.planned_release_on) || null };
    });
  }, [tasks, facts]);
  const years = [...new Set([currentYear, ...(year === "all" ? [] : [year]), ...rows.flatMap(r => r.date ? [r.date.slice(0, 4)] : [])])].sort().reverse();
  const annual = rows.filter(r => inHoursPeriod(r.date, year));
  const done = summary(annual.filter(r => r.done)), planned = summary(annual.filter(r => !r.done));
  const periods = year === "all" ? [
    ...[...new Set(rows.flatMap(r => r.date ? [r.date.slice(0, 4)] : []))].sort().map(y => ({ label: y, rows: rows.filter(r => r.date?.startsWith(y + "-")) })),
    ...(rows.some(r => !r.date) ? [{ label: "Без даты", rows: rows.filter(r => !r.date) }] : []),
  ] : months.map((label, i) => ({ label, rows: annual.filter(r => r.date && Number(r.date.slice(5, 7)) === i + 1) }));
  const monthly = periods.map(p => ({ label: p.label, done: summary(p.rows.filter(r => r.done)), planned: summary(p.rows.filter(r => !r.done)) }));
  const max = Math.max(1, ...monthly.flatMap(m => [m.done[unit], m.planned[unit]]));
  const tableRows = [...annual].sort((a, b) => {
    const value = (r: Row) => sort === "hours" ? r.task.approvedHours ?? null : sort === "id" ? r.task.id : r.task[sort];
    const av = value(a), bv = value(b);
    if (av == null || bv == null) return av == null && bv == null ? a.task.id - b.task.id : av == null ? 1 : -1;
    const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ru", { numeric: true });
    return (direction === "asc" ? result : -result) || a.task.id - b.task.id;
  });
  const sortBy = (next: Sort) => {
    if (sort === next) setDirection(d => d === "desc" ? "asc" : "desc");
    else { setSort(next); setDirection(next === "title" || next === "status" ? "asc" : "desc"); }
  };
  const columns: [Sort, string][] = [["id", "ID"], ["title", "Задача"], ["status", "Статус"], ["hours", "Согласовано, ч"]];
  return <section className="hours-view" aria-label="Статистика согласованных часов">
    <div className="hours-toolbar">
      <div><h2>Работа в цифрах</h2><span className="hours-loading" role="status">{loading ? "Обновление…" : ""}</span></div>
      <label>Период <select aria-label="Период" value={year} onChange={e => setYear(e.target.value)}>
        <option value="all">За всё время</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select></label>
    </div>
    {error && <div role="alert" className="tracker-error">Не удалось обновить статистику. {error} <button onClick={() => setRetry(n => n + 1)}>Повторить</button></div>}
    {facts && <>
      <div className="hours-summary">
        <article className="hours-stat completed"><span className="stat-eyebrow">Завершено</span><strong>{done.count > 0 && done.unknown === done.count ? "—" : number(done.hours)} <small>ч</small></strong><span>{tasksLabel(done.count)} · согласованный объём</span>{done.unknown > 0 && <small>Без оценки: {done.unknown}</small>}</article>
        <article className="hours-stat planned"><span className="stat-eyebrow">Ещё не завершено</span><strong>{planned.count > 0 && planned.unknown === planned.count ? "—" : number(planned.hours)} <small>ч</small></strong><span>{tasksLabel(planned.count)} · планируемая разработка</span>{planned.unknown > 0 && <small>Без оценки: {planned.unknown}</small>}</article>
        <div className="hours-progress">
          <div><b>{tasksLabel(annual.length)} в выборке</b><span>{number(done.hours + planned.hours)} ч согласовано</span></div>
          <div className="hours-progress-track" role="img" aria-label={`Завершено ${done.count} из ${annual.length} задач`}><i style={{ width: `${annual.length ? done.count / annual.length * 100 : 0}%` }} /></div>

        </div>
      </div>
      <div className="hours-chart-section">
        <div className="hours-chart-heading"><h2>{year === "all" ? "По годам" : "По месяцам"}</h2><div className="hours-switch" aria-label="Показатель графика"><button aria-pressed={unit === "hours"} onClick={() => setUnit("hours")}>Часы</button><button aria-pressed={unit === "count"} onClick={() => setUnit("count")}>Задачи</button></div></div>
        <div className="hours-chart-legend"><span className="completed">Завершено по факту</span><span className="planned">Не завершено · план релиза</span><small>Шкала: 0–{number(max)} {unit === "hours" ? "ч" : "задач"}</small></div>
        <div className="hours-chart-scroll"><div className="hours-chart" style={{ gridTemplateColumns: `repeat(${Math.max(1, monthly.length)}, 1fr)`, minWidth: year === "all" ? Math.max(260, monthly.length * 90) : 660 }} role="img" aria-label={`Распределение ${unit === "hours" ? "согласованных часов" : "задач"} ${year === "all" ? "за всё время" : `за ${year} год`}`}>
          {monthly.map(m => <div className="hours-month" key={m.label} aria-label={`${m.label}: завершено ${number(m.done[unit])}, не завершено ${number(m.planned[unit])}`}>
            <div className="hours-month-bars">{(["done", "planned"] as const).map(k => <div className={`hours-bar ${k}`} key={k} style={{ height: `${m[k][unit] / max * 100}%` }} title={`${m.label} · ${k === "done" ? "Завершено" : "План релиза"}: ${number(m[k].hours)} ч, ${tasksLabel(m[k].count)}${m[k].unknown ? `; без оценки: ${m[k].unknown}` : ""}`}><span>{m[k][unit] > 0 ? number(m[k][unit]) : unit === "hours" && m[k].unknown > 0 ? "?" : ""}</span></div>)}</div><b>{m.label}</b>
          </div>)}
        </div></div>
        {!annual.length && <p className="muted">Задач за этот период нет.</p>}
      </div>
      <div className="hours-table-heading"><h2>Задачи · {tableRows.length}</h2></div>
      <div className="hours-table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key} aria-sort={sort === key ? direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => sortBy(key)}>{label}{sort === key ? direction === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} /> : <ArrowUpDown size={13} />}</button></th>)}<th /></tr></thead>
        <tbody>{tableRows.map(({ task, done }) => <tr key={task.id}><td>{task.id}</td><td><button onClick={() => onOpenTask(task)}>{task.title}</button></td><td><span className={`hours-task-status ${done ? "completed" : ""}`}>{task.status}</span></td><td className="hours-value">{task.approvedHours == null ? <span className="muted">Нет оценки</span> : number(task.approvedHours)}</td><td><button aria-label={`Открыть карточку ${task.id}`} onClick={() => onOpenTask(task)}>↗</button></td></tr>)}</tbody>
      </table></div>
      {!tableRows.length && <p className="empty-state">Задач по этим условиям нет.</p>}
    </>}
  </section>;
}
