"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Info, LoaderCircle, RefreshCw, ArrowRight, Check } from "lucide-react"
import { ItsmAttachmentList, ItsmRichText as RichText, remainingAttachments } from "@/components/itsm-attachments"
import { attachmentNotePreview, normalizeAttachments } from "@/lib/itsm-attachments"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { request } from "@/lib/api"
import { INCIDENT_PRIORITIES, incidentDateTime, type Incident } from "@/lib/incidents"
import { entityName, httpLink, itsmLabel, ITSM_STATUSES, type ItsmDetails, type ItsmRecord, type ItsmSection } from "@/lib/itsm"

const asObject = (value: unknown): ItsmRecord => value && typeof value === "object" && !Array.isArray(value) ? value as ItsmRecord : {}
const errorText = (error: unknown) => error instanceof Error ? error.message : "Не удалось загрузить подробности"
const dateText = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? incidentDateTime(value) : "Не указано"
const specialValues: Record<string, string> = { best_effort: "Без фиксированного срока", no_target: "Срок не установлен", clock_stopped: "Отсчёт приостановлен", incident: "Инцидент", low: "Низкий", medium: "Средний", high: "Высокий", top: "Критический" }

function Fold({ title, children, initiallyOpen = false, className = "" }: { title: ReactNode; children: ReactNode; initiallyOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(initiallyOpen)
  return <details className={className} open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary>{title}</summary>{open && children}</details>
}
function Value({ value, field = "" }: { value: unknown; field?: string }) {
  if (value == null || value === "") return <span className="itsm-empty">Не указано</span>
  if (typeof value === "boolean") return <>{value ? "Да" : "Нет"}</>
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return <time dateTime={value}>{dateText(value)}</time>
  if (Array.isArray(value) && ["attachments", "note_attachments"].includes(field)) return <ItsmAttachmentList value={value} />
  if (Array.isArray(value)) return value.length ? <Fold title={`Элементов: ${value.length}`} className="itsm-nested"><div className="itsm-object-list">{value.map((item, index) => <div key={index}><Value value={item} /></div>)}</div></Fold> : <span className="itsm-empty">Нет</span>
  if (typeof value === "object") {
    const entries = Object.entries(value as ItsmRecord)
    return entries.length ? <Fold title={entityName(value)} className="itsm-nested"><Fields data={value as ItsmRecord} /></Fold> : <span className="itsm-empty">Нет</span>
  }
  if (httpLink(value)) return <a href={httpLink(value)} target="_blank" rel="noopener noreferrer">{String(value)}</a>
  const text = String(value)
  return <span className="itsm-plain">{field === "status" ? ITSM_STATUSES[text] || text : specialValues[text] || text}</span>
}
function Fields({ data }: { data: ItsmRecord }) {
  return <dl className="itsm-fields">{Object.entries(data).map(([key, value]) => <div key={key}><dt title={key}>{itsmLabel(key)}</dt><dd><Value value={value} field={key} /></dd></div>)}</dl>
}
function Note({ note, initiallyOpen = false }: { note: ItsmRecord; initiallyOpen?: boolean }) {
  const inline = remainingAttachments(note.text, note.attachments)
  const hasOtherAttachments = normalizeAttachments(note.attachments).some(file => !inline.has(file.id))
  return <Fold initiallyOpen={initiallyOpen} className="itsm-note" title={<><span className="itsm-note-author">{entityName(note.person)}{note.internal === true && <small>Внутренняя</small>}</span><time>{dateText(note.created_at)}</time><span className="itsm-note-preview">{attachmentNotePreview(note.text)}</span></>}>
    <RichText text={note.text} attachmentData={note.attachments} />
    {hasOtherAttachments && <div className="itsm-note-files"><h4>Вложения</h4><ItsmAttachmentList value={note.attachments} omit={inline} /></div>}
    <Fold title="Все поля записи" className="itsm-nested"><Fields data={Object.fromEntries(Object.entries(note).filter(([key]) => !["text", "attachments"].includes(key)))} /></Fold>
  </Fold>
}
function SectionNotice({ section }: { section?: ItsmSection }) {
  return section && !section.complete ? <p role="status" className="itsm-warning">{section.error}{section.items.length ? ` Показана полученная часть: ${section.items.length}.` : ""}</p> : null
}
function HistoryEntry({ entry }: { entry: ItsmRecord }) {
  const changes = Object.entries(asObject(entry.changes)), actor = entry.created_by || entry.user
  return <Fold className="itsm-history-entry" title={<><span>{entry.action === "create" ? "Создание инцидента" : entry.action === "update" ? "Изменение" : "Событие"}</span><time>{dateText(entry.created_at)}</time><small>{entityName(actor)} · {changes.slice(0, 3).map(([key]) => itsmLabel(key)).join(", ")}{changes.length > 3 ? ` и ещё ${changes.length - 3}` : ""}</small></>}>
    {changes.length > 0 && <div className="itsm-change-table"><table><thead><tr><th>Поле</th><th>Было</th><th>Стало</th></tr></thead><tbody>{changes.map(([key, value]) => <tr key={key}><th>{itsmLabel(key)}</th>{Array.isArray(value) && value.length === 2 ? <><td><Value value={value[0]} field={key} /></td><td><Value value={value[1]} field={key} /></td></> : <td colSpan={2}><Value value={value} field={key} /></td>}</tr>)}</tbody></table></div>}
    <Fold title="Все поля события" className="itsm-nested"><Fields data={entry} /></Fold>
  </Fold>
}

export function IncidentDetails({ incident, canEdit, onClose, onSaved }: { incident: Incident; canEdit: boolean; onClose: () => void; onSaved: (incident: Incident) => void }) {
  const [data, setData] = useState<ItsmDetails | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("")
  const [tab, setTab] = useState("overview"), [search, setSearch] = useState(""), [limit, setLimit] = useState(40)
  const [syncing, setSyncing] = useState(false), [notice, setNotice] = useState("")
  const controller = useRef<AbortController | null>(null), alive = useRef(true)
  const id = incident.id
  const load = useCallback(async () => {
    controller.current?.abort()
    const current = new AbortController(); controller.current = current
    setLoading(true); setError(""); setData(null); setNotice("")
    try {
      const result = await request<ItsmDetails>(`/incidents/${id}/itsm`, { cache: "no-store", signal: AbortSignal.any([current.signal, AbortSignal.timeout(90000)]) })
      if (!current.signal.aborted && alive.current) { setData(result); setLimit(40) }
    } catch (cause) { if (!current.signal.aborted && alive.current) setError(errorText(cause)) }
    finally { if (!current.signal.aborted && alive.current) setLoading(false) }
  }, [id])
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; controller.current?.abort() } }, [load])
  const synchronize = async () => {
    if (!data || !canEdit || syncing) return
    setSyncing(true); setError(""); setNotice("")
    try {
      const result = await request<{ incident: Incident; changed_fields: string[]; record: ItsmRecord; checked_at: string; synchronization: ItsmDetails["synchronization"] }>(`/incidents/${id}/itsm/sync`, { method: "POST", body: JSON.stringify({ version: data.incident_version }) })
      if (!alive.current) return
      onSaved(result.incident)
      setData(previous => previous ? { ...previous, incident: result.incident, record: result.record, checked_at: result.checked_at, incident_version: result.incident.version, synchronization: result.synchronization } : previous)
      setNotice(result.changed_fields.length ? "Поля инцидента обновлены" : "Данные уже совпадают")
    } catch (cause) { if (alive.current) setError(errorText(cause)) }
    finally { if (alive.current) setSyncing(false) }
  }
  const record = data?.record || {}, sections = data?.sections || {}, notes = sections.notes?.items || [], history = sections.audit?.items || []
  const orderedNotes = [...notes].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")) || Number(a.id) - Number(b.id))
  const unavailable = Object.values(sections).filter(section => !section.complete)
  const match = (item: unknown) => !search.trim() || JSON.stringify(item).toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru"))
  const shownNotes = [...orderedNotes].reverse().filter(match), shownHistory = [...history].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || Number(b.id) - Number(a.id)).filter(match)
  const syncValues = data?.synchronization.values
  const local = data?.incident || incident
  const tabs = [["overview", "Обзор"], ["notes", `Обсуждение (${notes.length})`], ["history", `История (${history.length})`], ["fields", "Все поля"]]
  return <Dialog open onOpenChange={open => { if (!open && !syncing) onClose() }}><DialogContent className="incident-details-modal" showCloseButton={!syncing} onInteractOutside={event => { if (syncing) event.preventDefault() }} onEscapeKeyDown={event => { if (syncing) event.preventDefault() }}>
    <DialogHeader className="itsm-header"><div className="itsm-eyeline"><Info size={16} />МосИТСМ · {incident.number}</div><DialogTitle>{loading ? "Подробная информация" : String(record.subject || "Подробная информация")}</DialogTitle><DialogDescription className={data ? undefined : "sr-only"}>{data ? `Получено ${dateText(data.checked_at)} МСК` : "Подробная информация из МосИТСМ"}</DialogDescription></DialogHeader>
    {data && !loading && <div className="itsm-tabs" role="tablist" aria-label="Подробности инцидента">{tabs.map(([key, label], index) => <button key={key} role="tab" id={`itsm-tab-${key}`} tabIndex={tab === key ? 0 : -1} aria-selected={tab === key} aria-controls="itsm-panel" onClick={() => { setTab(key); setSearch(""); setLimit(40) }} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next][0]); setSearch(""); setLimit(40); document.getElementById(`itsm-tab-${tabs[next][0]}`)?.focus() }}>{label}</button>)}</div>}
    <div className="itsm-scroll" id="itsm-panel" role={data ? "tabpanel" : undefined} aria-labelledby={data ? `itsm-tab-${tab}` : undefined}>
      {loading && <div className="itsm-loading" role="status"><LoaderCircle className="itsm-spinner" size={30} /><strong>Загружаем сведения из МосИТСМ</strong><div className="itsm-skeleton"><i /><i /><i /></div></div>}
      {error && <p role="alert" className="itsm-error">{error}</p>}
      {!loading && !data && <button className="itsm-button" onClick={() => void load()}><RefreshCw size={15} />Повторить загрузку</button>}
      {data && !loading && <>
        {unavailable.length > 0 && <Fold className="itsm-unavailable" title={`Разделы с ограничениями: ${unavailable.length}`}><ul>{unavailable.map(section => <li key={section.title}><b>{section.title}:</b> {section.error}</li>)}</ul></Fold>}
        {tab === "overview" && <>
          {local.status && local.status !== "active" && <div className={`itsm-local-outcome outcome-${local.status}`}><b>Архив SimpleTracker: {local.status === "completed" ? "закрыт успешно" : "сгорел"}</b>{local.closure_deadline_at && <span>Срок {dateText(local.closure_deadline_at)}</span>}</div>}
          <div className="itsm-status-line"><span className="itsm-status">{ITSM_STATUSES[String(record.status)] || String(record.status || "Статус не указан")}</span><span className={`incident-priority priority-${record.impact === "top" ? "high" : record.impact}`}>{specialValues[String(record.impact)] || "Важность не указана"}</span>{record.urgent === true && <b>Срочный</b>}</div>
          <Fields data={Object.fromEntries(["member", "team", "service_instance", "organization", "created_at", "updated_at", "resolution_target_at", "next_target_at", "waiting_until", "desired_completion_at", "response_target_at", "requester_resolution_target_at", "created_by", "requested_by", "requested_for", "completed_at", "completion_reason", "source"].map(key => [key, record[key]]))} />
          <section className="itsm-block"><h3>Первое сообщение</h3><SectionNotice section={sections.notes} />{orderedNotes[0] ? <Note note={orderedNotes[0]} initiallyOpen /> : <p className="itsm-empty">{sections.notes?.complete ? "Сообщений нет" : "Сообщения недоступны"}</p>}</section>
          {record.summary != null && <section className="itsm-block"><h3>Описание</h3><RichText text={record.summary} /></section>}
          {canEdit && <section className="itsm-sync-preview"><h3>Синхронизация с SimpleTracker</h3>{syncValues ? <><div className="itsm-sync-grid">{(["priority", "expires_at", "is_deferred", "deferred_until"] as const).map(key => <div key={key}><b>{{ priority: "Приоритет", expires_at: "Дата сгорания", is_deferred: "Отложен", deferred_until: "Отложен до" }[key]}</b><span>{key === "priority" ? INCIDENT_PRIORITIES[local.priority] : key === "is_deferred" ? local.is_deferred ? "Да" : "Нет" : dateText(local[key])}</span><ArrowRight size={14} /><strong>{key === "priority" ? INCIDENT_PRIORITIES[syncValues.priority] : key === "is_deferred" ? syncValues.is_deferred ? "Да" : "Нет" : dateText(syncValues[key])}</strong></div>)}</div></> : <p className="itsm-warning">{data.synchronization.error}</p>}</section>}
        </>}
        {(tab === "notes" || tab === "history") && <><input className="itsm-search" aria-label={tab === "notes" ? "Поиск в обсуждении" : "Поиск в истории"} placeholder={tab === "notes" ? "Найти в переписке" : "Найти изменение"} value={search} onChange={event => { setSearch(event.target.value); setLimit(40) }} /><SectionNotice section={sections[tab === "notes" ? "notes" : "audit"]} />
          {tab === "notes" ? shownNotes.slice(0, limit).map((note, index) => <Note key={String(note.id ?? index)} note={note} />) : shownHistory.slice(0, limit).map((entry, index) => <HistoryEntry key={String(entry.id ?? index)} entry={entry} />)}
          {!(tab === "notes" ? shownNotes : shownHistory).length && <p className="itsm-empty">{search ? "По запросу ничего не найдено" : sections[tab === "notes" ? "notes" : "audit"]?.complete ? "Записей нет" : "Записи недоступны"}</p>}
          {(tab === "notes" ? shownNotes : shownHistory).length > limit && <button className="itsm-button" onClick={() => setLimit(value => value + 40)}>Показать ещё</button>}
        </>}
        {tab === "fields" && <><input className="itsm-search" aria-label="Поиск по полям" placeholder="Найти поле или значение" value={search} onChange={event => setSearch(event.target.value)} /><h3 className="itsm-section-title">Все поля карточки</h3><Fields data={Object.fromEntries(Object.entries(record).filter(([key, value]) => match({ [itsmLabel(key)]: value, key })))} />
          {Object.entries(sections).filter(([key]) => !["notes", "audit"].includes(key)).map(([key, section]) => <Fold key={key} className="itsm-related" title={<>{section.title}<small>{section.items.length}{!section.complete ? " · не полностью" : ""}</small></>}><SectionNotice section={section} />{section.items.filter(match).length ? key === "note_attachments" ? <ItsmAttachmentList value={section.items.filter(match)} /> : section.items.filter(match).map((item, index) => <Fold key={String(item.id ?? index)} title={entityName(item)} className="itsm-nested"><Fields data={asObject(item)} /></Fold>) : <p className="itsm-empty">Записей нет</p>}</Fold>)}
        </>}
      </>}
    </div>
    <div className="itsm-footer"><div aria-live="polite">{notice && <span className="itsm-success"><Check size={16} />{notice}</span>}</div><button className="itsm-button" disabled={loading || syncing} onClick={() => void load()}><RefreshCw size={15} />Запросить заново</button>{canEdit && <button className="itsm-button itsm-primary" disabled={!data?.synchronization.values || loading || syncing} onClick={() => void synchronize()}>{syncing ? <LoaderCircle className="itsm-spinner" size={16} /> : <RefreshCw size={16} />}{syncing ? "Синхронизация…" : "Синхронизировать"}</button>}</div>
  </DialogContent></Dialog>
}
