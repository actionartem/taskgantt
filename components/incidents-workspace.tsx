"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ExternalLink, Pencil, UserRound, Info, CircleCheck, Archive, TriangleAlert } from "lucide-react"
import { IncidentDetails } from "@/components/incident-details"
import { request } from "@/lib/api"
import {
  INCIDENT_PRIORITIES, incidentDateTime, incidentDay, incidentDeadline, incidentInputTime,
  incidentInstant, incidentMonthDays, shiftIncidentMonth,
} from "@/lib/incidents"
import type { Incident, IncidentInput, IncidentPriority } from "@/lib/incidents"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Draft = { number: string; jira_url: string; priority: IncidentPriority; expires_at: string; is_deferred: boolean; deferred_until: string; comment: string }
type Editor = { incident: Incident | null; draft: Draft }
const blank = (): Draft => ({ number: "", jira_url: "", priority: "medium", expires_at: "", is_deferred: false, deferred_until: "", comment: "" })
const fromIncident = (i: Incident): Draft => ({ number: i.number, jira_url: i.jira_url, priority: i.priority, expires_at: incidentInputTime(i.expires_at), is_deferred: i.is_deferred, deferred_until: i.deferred_until ? incidentInputTime(i.deferred_until) : "", comment: i.comment || "" })
const monthLabel = (month: string) => new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))
const dayLabel = (day: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))
const message = (error: unknown) => error instanceof Error ? error.message : "Не удалось выполнить действие"
function jiraLabel(url: string) {
  try { const path = new URL(url).pathname.split("/").filter(Boolean); return decodeURIComponent(path.at(-1) || "Jira") } catch { return "Jira" }
}

export function IncidentsWorkspace({ onProfile, canEdit }: { onProfile: () => void; canEdit: boolean }) {
  const [items, setItems] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState("")
  const [today, setToday] = useState(() => incidentDay(new Date()))
  const [month, setMonth] = useState(() => incidentDay(new Date()).slice(0, 7))
  const [selectedDay, setSelectedDay] = useState(() => incidentDay(new Date()))
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [detailsIncident, setDetailsIncident] = useState<Incident | null>(null)
  const [closing, setClosing] = useState<Incident | null>(null)
  const [closeBusy, setCloseBusy] = useState(false)
  const [closeError, setCloseError] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sequence = useRef(0)
  const busy = useRef(false)
  const alive = useRef(true)
  const refresh = useCallback(async () => {
    const seq = ++sequence.current
    setLoading(true)
    try {
      const result = await request<{ items: Incident[] }>("/incidents")
      if (alive.current && seq === sequence.current) { setItems(result.items); setLoaded(true); setError("") }
    } catch (cause) {
      if (alive.current && seq === sequence.current) setError(message(cause))
    } finally {
      if (alive.current && seq === sequence.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    alive.current = true
    void refresh()
    const update = () => {
      setToday(incidentDay(new Date()))
      if (!busy.current && document.visibilityState === "visible") void refresh()
    }
    window.addEventListener("focus", update)
    const interval = setInterval(update, 120000)
    return () => { alive.current = false; clearInterval(interval); window.removeEventListener("focus", update) }
  }, [refresh])

  const filtered = useMemo(() => items.filter(i =>
    (!search.trim() || `${i.number} ${i.jira_url}`.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru"))) &&
    (!priority || i.priority === priority),
  ).sort((a, b) => +new Date(incidentDeadline(a)) - +new Date(incidentDeadline(b)) || a.number.localeCompare(b.number, "ru", { numeric: true })), [items, search, priority])
  const visible = useMemo(() => filtered.filter(i => !i.status || i.status === "active"), [filtered])
  const archived = useMemo(() => filtered.filter(i => i.status && i.status !== "active").sort((a, b) => +new Date(b.closed_at || b.updated_at) - +new Date(a.closed_at || a.updated_at)), [filtered])
  const byDay = useMemo(() => {
    const map = new Map<string, Incident[]>()
    for (const item of visible) {
      const day = incidentDay(incidentDeadline(item))
      map.set(day, [...(map.get(day) || []), item])
    }
    return map
  }, [visible])
  const dayItems = byDay.get(selectedDay) || []
  const openEditor = (incident: Incident | null, deferred?: boolean) => {
    if (!canEdit && !incident) return
    const draft = incident ? fromIncident(incident) : blank()
    if (deferred !== undefined) draft.is_deferred = deferred
    setEditor({ incident, draft }); setFormError(""); setConfirmDiscard(false); setConfirmDelete(false)
  }
  const selectIncident = (incident: Incident) => {
    const day = incidentDay(incidentDeadline(incident))
    setSelected(incident.id); setSelectedDay(day); setMonth(day.slice(0, 7))
  }
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setEditor(previous => previous ? { ...previous, draft: { ...previous.draft, [key]: value } } : null)
    setFormError(""); setConfirmDelete(false)
  }
  const closeEditor = () => {
    if (busy.current || !editor) return
    const original = editor.incident ? fromIncident(editor.incident) : blank()
    if (JSON.stringify(editor.draft) !== JSON.stringify(original)) setConfirmDiscard(true)
    else setEditor(null)
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit || !editor || busy.current) return
    setFormError("")
    const draft = editor.draft
    if (draft.is_deferred && draft.deferred_until <= draft.expires_at) {
      setFormError("Новый срок должен быть позже исходной даты сгорания"); return
    }
    busy.current = true; setSaving(true); sequence.current++; setLoading(false)
    try {
      const payload: IncidentInput & { version?: number } = {
        number: draft.number.trim(), jira_url: draft.jira_url.trim(), priority: draft.priority,
        expires_at: incidentInstant(draft.expires_at), is_deferred: draft.is_deferred,
        deferred_until: draft.is_deferred ? incidentInstant(draft.deferred_until) : null, comment: draft.comment,
        ...(editor.incident ? { version: editor.incident.version } : {}),
      }
      const saved = await request<Incident>(editor.incident ? `/incidents/${editor.incident.id}` : "/incidents", {
        method: editor.incident ? "PATCH" : "POST", body: JSON.stringify(payload),
      })
      if (!alive.current) return
      setItems(previous => [...previous.filter(i => i.id !== saved.id), saved])
      setLoaded(true); setError(""); selectIncident(saved); setEditor(null)
    } catch (cause) {
      if (alive.current) { setFormError(message(cause)); void refresh() }
    } finally { busy.current = false; if (alive.current) setSaving(false) }
  }
  const remove = async () => {
    if (!editor?.incident || busy.current) return
    busy.current = true; setSaving(true); sequence.current++; setLoading(false)
    try {
      await request(`/incidents/${editor.incident.id}`, { method: "DELETE", body: JSON.stringify({ version: editor.incident.version }) })
      if (!alive.current) return
      setItems(previous => previous.filter(i => i.id !== editor.incident!.id)); setEditor(null); setSelected(null)
    } catch (cause) { if (alive.current) { setFormError(message(cause)); void refresh() } }
    finally { busy.current = false; if (alive.current) setSaving(false) }
  }
  const acceptIncident = (saved: Incident) => {
    sequence.current++; setLoading(false); setError("")
    setItems(previous => [...previous.filter(i => i.id !== saved.id), saved])
    setDetailsIncident(previous => previous?.id === saved.id ? saved : previous)
    setLoaded(true)
  }
  const closeIncident = async (status: "completed" | "burned") => {
    if (!closing || closeBusy) return
    setCloseBusy(true); setCloseError("")
    try {
      const saved = await request<Incident>(`/incidents/${closing.id}/close`, { method: "POST", body: JSON.stringify({ status, version: closing.version }) })
      acceptIncident(saved); setClosing(null); setSelected(null)
    } catch (cause) { setCloseError(message(cause)); void refresh() }
    finally { setCloseBusy(false) }
  }
  const incidentTable = (rows: Incident[], archive = false) => <div className="incidents-table-scroll"><table className="incidents-table">
    <thead><tr><th>Номер инцидента</th><th>Задача в Jira</th><th>Приоритет</th><th>Дата сгорания</th><th>Уже отложен</th><th>Отложен до</th><th>Комментарий</th>{archive && <th>Результат</th>}<th><span className="sr-only">Действия</span></th></tr></thead>
    <tbody>{rows.map(incident => <tr key={incident.id} className={`${selected === incident.id ? "is-selected" : ""} ${archive ? `incident-archived-${incident.status}` : ""}`}>
      <td><div className="incident-number-actions"><button className="incident-number" aria-label={`Открыть инцидент ${incident.number}`} onClick={() => { if (!archive) selectIncident(incident); openEditor(incident) }}>{incident.number}</button>{!archive && canEdit && <button className="incident-edit" title="Закрыть инцидент" aria-label={`Закрыть ${incident.number}`} onClick={() => { setClosing(incident); setCloseError("") }}><CircleCheck size={16} /></button>}</div></td>
      <td><a href={incident.jira_url} target="_blank" rel="noopener noreferrer" title={incident.jira_url}>{jiraLabel(incident.jira_url)} <ExternalLink size={13} /></a></td>
      <td><span className={`incident-priority priority-${incident.priority}`}>{INCIDENT_PRIORITIES[incident.priority]}</span></td>
      <td><time dateTime={incident.expires_at}>{incidentDateTime(incident.expires_at)}</time></td>
      <td><label className="incident-check"><input type="checkbox" checked={incident.is_deferred} disabled={!canEdit} aria-label={`Отложен ${incident.number}`} onChange={event => openEditor(incident, event.target.checked)} /><span>{incident.is_deferred ? "Да" : "Нет"}</span></label></td>
      <td>{incident.is_deferred && incident.deferred_until ? <time dateTime={incident.deferred_until}>{incidentDateTime(incident.deferred_until)}</time> : "—"}</td>
      <td className="incident-comment-cell"><span title={incident.comment || undefined}>{incident.comment || "—"}</span></td>
      {archive && <td><span className={`incident-outcome outcome-${incident.status}`}>{incident.status === "completed" ? "Закрыт успешно" : "Сгорел"}</span><small className="incident-closure-meta">{incident.closure_source === "manual" ? "Вручную" : "МосИТСМ"}{incident.closed_at ? ` · ${incidentDateTime(incident.closed_at)}` : ""}</small></td>}
      <td><div className="incident-row-actions">{incident.check_error && !archive && <span title={incident.check_error} aria-label="Не удалось автоматически проверить МосИТСМ"><TriangleAlert size={15} /></span>}<button className="incident-edit" title="Подробная информация из МосИТСМ" aria-label={`Подробнее ${incident.number}`} onClick={() => setDetailsIncident(incident)}><Info size={17} /></button>{canEdit && <button className="incident-edit" aria-label={`Изменить ${incident.number}`} onClick={() => openEditor(incident)}><Pencil size={15} /></button>}</div></td>
    </tr>)}</tbody>
  </table></div>

  return <div className="tracker-frame incidents-frame">
    <header className="tracker-header">
      <div className="brand-cat"><img src="/favicon_cat_128.png" alt="Кот-клоун SimpleTracker" width={64} height={64} /></div>
      <div className="brand-name">Simple<br />Tracker</div>
      <h1>Инциденты</h1>
      <div className="header-meta">{loaded ? `${visible.length} открытых инцидентов` : "Загрузка…"}<br />Время московское</div>
      <div className="header-actions">
        <button onClick={onProfile} aria-label="Профиль"><UserRound size={18} /></button>
        {canEdit && <button className="accent-button" onClick={() => openEditor(null)}>+ Новый инцидент</button>}
      </div>
    </header>
    <nav className="tracker-tabs" aria-label="Разделы">
      <Link href="/">Задачи и Гант</Link>
      <Link href="/?view=documents">Документы</Link><Link href="/?view=hours">Часы</Link>
      <Link href="/incidents" className="incidents-tab" aria-current="page">Инциденты</Link>
    </nav>
    <div className="tracker-filters incidents-filters">
      <input aria-label="Поиск инцидентов" placeholder="Номер инцидента или Jira" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Приоритет" value={priority} onChange={e => setPriority(e.target.value)}><option value="">Приоритет: все</option>{Object.entries(INCIDENT_PRIORITIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      {(search || priority) && <button onClick={() => { setSearch(""); setPriority("") }}>Сбросить фильтры</button>}
    </div>
    {error && <div className="tracker-error" role="alert">{loaded ? "Данные могли устареть. " : "Не удалось загрузить инциденты. "}{error}</div>}
    <main className="incidents-layout" aria-label="Инциденты и календарь">
      <section className="incidents-table-panel" aria-label="Список инцидентов" aria-busy={loading}>
        {incidentTable(visible)}
        {!visible.length && <div className="incidents-empty" role="status">{loading && !loaded ? "Загружаем инциденты…" : !loaded ? "Список недоступен. Попробуйте обновить данные." : items.length ? "Нет инцидентов по выбранным фильтрам" : "Инцидентов пока нет"}</div>}
        <details className="incidents-archive"><summary><Archive size={16} />Архив <span>{archived.length}</span></summary>{archived.length ? incidentTable(archived, true) : <p className="itsm-empty">Закрытых инцидентов нет</p>}</details>
      </section>
      <section className="incidents-calendar-panel" aria-label="Календарь инцидентов">
        <div className="incidents-calendar-heading"><h2>Календарь инцидентов</h2></div>
        <div className="incidents-month-nav"><button aria-label="Предыдущий месяц" disabled={month <= "2000-01"} onClick={() => setMonth(shiftIncidentMonth(month, -1))}><ChevronLeft size={18} /></button><h3 aria-live="polite">{monthLabel(month)}</h3><button aria-label="Следующий месяц" disabled={month >= "2100-12"} onClick={() => setMonth(shiftIncidentMonth(month, 1))}><ChevronRight size={18} /></button></div>
        <div className="incidents-weekdays" aria-hidden="true">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <span key={day}>{day}</span>)}</div>
        <div className="incidents-calendar-grid">
          {incidentMonthDays(month).map(day => {
            const incidents = byDay.get(day) || []
            return <button key={day} className={`incident-day ${day.slice(0, 7) !== month ? "other-month" : ""} ${day === today ? "is-today" : ""}`} aria-label={`${dayLabel(day)}, инцидентов: ${incidents.length}`} aria-pressed={day === selectedDay} aria-current={day === today ? "date" : undefined} onClick={() => { setSelectedDay(day); setSelected(null); if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7)) }}>
              <span>{Number(day.slice(8))}</span><span className="incident-day-dots" aria-hidden="true">{incidents.slice(0, 4).map(i => <span key={i.id} className="incident-dot" />)}{incidents.length > 4 && <small>+{incidents.length - 4}</small>}</span>
            </button>
          })}
        </div>
        <div className="incidents-day-list" aria-live="polite"><h3>{dayLabel(selectedDay)} <span>{dayItems.length}</span></h3>
          {!dayItems.length && <p className="incidents-day-empty">{loaded ? "На эту дату сроков нет" : "Данные ещё не загружены"}</p>}
          {dayItems.map(i => <div key={i.id} className={`incident-day-item ${selected === i.id ? "is-selected" : ""}`}>
            <button className="incident-number" onClick={() => openEditor(i)}>{i.number}</button>
            <span className={`incident-priority priority-${i.priority}`}>{INCIDENT_PRIORITIES[i.priority]}</span>
            <time dateTime={incidentDeadline(i)}>{incidentInputTime(incidentDeadline(i)).slice(11)}</time>
            {canEdit && <button className="incident-edit" aria-label={`Редактировать ${i.number}`} onClick={() => openEditor(i)}><Pencil size={15} /></button>}
          </div>)}
        </div>
      </section>
    </main>
    <Dialog open={!!editor} onOpenChange={open => { if (!open) closeEditor() }}>
      <DialogContent className="incident-editor" showCloseButton={!saving}>
        <DialogHeader><DialogTitle>{editor?.incident ? `Инцидент ${editor.incident.number}` : "Новый инцидент"}</DialogTitle><DialogDescription>Дата и время по Москве (МСК, UTC+3).</DialogDescription></DialogHeader>
        {editor && <form onSubmit={save}>
          <fieldset disabled={saving || !canEdit} className="incident-form-fields">
            <label htmlFor="incident-number">Номер инцидента<input id="incident-number" required maxLength={100} value={editor.draft.number} onChange={e => change("number", e.target.value)} autoFocus /></label>
            <label htmlFor="incident-jira">Ссылка на задачу Jira<input id="incident-jira" type="url" required maxLength={2000} placeholder="https://jira…/browse/…" value={editor.draft.jira_url} onChange={e => change("jira_url", e.target.value)} /></label>
            <div className="incident-form-pair"><label htmlFor="incident-priority">Приоритет<select id="incident-priority" value={editor.draft.priority} onChange={e => change("priority", e.target.value as IncidentPriority)}>{Object.entries(INCIDENT_PRIORITIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label htmlFor="incident-expires">Дата сгорания<input id="incident-expires" type="datetime-local" required min="2000-01-01T00:00" max="2100-12-31T23:59" value={editor.draft.expires_at} onInput={e => change("expires_at", e.currentTarget.value)} onChange={e => change("expires_at", e.target.value)} /></label></div>
            <label className="incident-check" htmlFor="incident-deferred"><input id="incident-deferred" type="checkbox" checked={editor.draft.is_deferred} onChange={e => change("is_deferred", e.target.checked)} />Уже отложен</label>
            {editor.draft.is_deferred && <label htmlFor="incident-until">Отложен до<input id="incident-until" type="datetime-local" required min={editor.draft.expires_at || "2000-01-01T00:00"} max="2100-12-31T23:59" value={editor.draft.deferred_until} onInput={e => change("deferred_until", e.currentTarget.value)} onChange={e => change("deferred_until", e.target.value)} /></label>}
            <label htmlFor="incident-comment">Комментарий<textarea id="incident-comment" rows={4} maxLength={10000} value={editor.draft.comment} onChange={event => change("comment", event.target.value)} /></label>
          </fieldset>
          {formError && <p className="incident-form-error" role="alert">{formError}</p>}
          {confirmDiscard ? <div className="incident-confirm" role="alert"><p>Закрыть без сохранения изменений?</p><button type="button" onClick={() => setConfirmDiscard(false)}>Продолжить редактирование</button><button type="button" onClick={() => setEditor(null)}>Закрыть без сохранения</button></div>
            : confirmDelete ? <div className="incident-confirm" role="alert"><p>Удалить инцидент {editor.incident?.number}?</p><button type="button" disabled={saving} onClick={() => setConfirmDelete(false)}>Отмена</button><button type="button" disabled={saving} className="incident-delete" onClick={() => void remove()}>{saving ? "Удаление…" : "Удалить инцидент"}</button></div>
            : <div className="incident-form-actions">{canEdit && editor.incident && <button type="button" className="incident-delete" disabled={saving} onClick={() => setConfirmDelete(true)}>Удалить</button>}<button type="button" disabled={saving} onClick={closeEditor}>{canEdit ? "Отмена" : "Закрыть"}</button>{canEdit && <button type="submit" className="accent-button" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</button>}</div>}
        </form>}
      </DialogContent>
    </Dialog>
    {detailsIncident && <IncidentDetails incident={detailsIncident} canEdit={canEdit && (!detailsIncident.status || detailsIncident.status === "active")} onClose={() => setDetailsIncident(null)} onSaved={acceptIncident} />}
    <Dialog open={!!closing} onOpenChange={open => { if (!open && !closeBusy) setClosing(null) }}><DialogContent className="incident-close-modal" showCloseButton={!closeBusy} onInteractOutside={event => { if (closeBusy) event.preventDefault() }} onEscapeKeyDown={event => { if (closeBusy) event.preventDefault() }}><DialogHeader><DialogTitle>Закрыть инцидент {closing?.number}</DialogTitle><DialogDescription>Выберите результат. Инцидент перейдёт в архив, автоматические проверки прекратятся.</DialogDescription></DialogHeader>{closeError && <p className="itsm-error" role="alert">{closeError}</p>}<div className="incident-close-options"><button disabled={closeBusy} className="close-completed" onClick={() => void closeIncident("completed")}><CircleCheck size={23} /><b>Закрыт успешно</b><span>Работа выполнена</span></button><button disabled={closeBusy} className="close-burned" onClick={() => void closeIncident("burned")}><TriangleAlert size={23} /><b>Сгорел</b><span>Срок нарушен</span></button></div>{closeBusy && <p role="status">Сохраняем результат…</p>}</DialogContent></Dialog>
  </div>
}
