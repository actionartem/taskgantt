"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Check, LoaderCircle, X } from "lucide-react"
import { ApiError, request } from "@/lib/api"
import type { Incident } from "@/lib/incidents"

export function IncidentComment({ incident, canEdit, onSaved, onEditingChange }: {
  incident: Incident
  canEdit: boolean
  onSaved: (incident: Incident) => void
  onEditingChange: (id: string, editing: boolean) => void
}) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false), [error, setError] = useState("")
  const [conflict, setConflict] = useState<Incident | null>(null)
  const original = useRef({ comment: "", version: 0 })
  const pending = useRef(false), alive = useRef(true), textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; onEditingChange(incident.id, false) }
  }, [incident.id, onEditingChange])
  useLayoutEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto"
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 240)}px`
    }
  }, [draft, editing])
  const finish = () => { setEditing(false); setError(""); setConflict(null); onEditingChange(incident.id, false) }
  const start = () => {
    original.current = { comment: incident.comment || "", version: incident.version }
    setDraft(original.current.comment); setError(""); setConflict(null); setEditing(true); onEditingChange(incident.id, true)
  }
  const cancel = () => { if (!pending.current) { if (conflict) onSaved(conflict); finish() } }
  const save = async (replace = false) => {
    if (pending.current) return
    if (!replace && draft === original.current.comment) { finish(); return }
    pending.current = true; setSaving(true); setError("")
    try {
      const write = (version: number) => request<Incident>(`/incidents/${incident.id}/comment`, { method: "PATCH", body: JSON.stringify({ comment: draft, version }) })
      let saved: Incident
      try { saved = await write(replace && conflict ? conflict.version : original.current.version) }
      catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 409) throw cause
        const latest = (await request<{ items: Incident[] }>("/incidents")).items.find(row => row.id === incident.id)
        if (!latest) throw new Error("Инцидент удалён. Комментарий не сохранён", { cause })
        if (latest.comment === draft) saved = latest
        else if (latest.comment === original.current.comment) saved = await write(latest.version)
        else { if (alive.current) { setConflict(latest); setError("Комментарий изменён в другом окне. Ваш текст не сохранён.") }; return }
      }
      onSaved(saved)
      if (alive.current) finish()
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Не удалось сохранить комментарий") }
    finally { pending.current = false; if (alive.current) setSaving(false) }
  }
  if (!editing) return canEdit
    ? <button type="button" className="incident-comment-trigger" aria-label={`Комментарий ${incident.number}`} onClick={start}><span>{incident.comment || "—"}</span></button>
    : <span className="incident-comment-readonly">{incident.comment || "—"}</span>
  return <div className="incident-comment-editor" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !error && !conflict) void save() }}>
    <textarea ref={textarea} autoFocus aria-label={`Комментарий ${incident.number}`} maxLength={10000} value={draft} readOnly={saving} rows={3}
      onChange={event => { setDraft(event.target.value); setError("") }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === "Escape") { event.preventDefault(); cancel() }
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(Boolean(conflict)) }
      }} />
    <div className="incident-comment-actions">
      {saving && <span role="status"><LoaderCircle className="itsm-spinner" size={14} />Сохранение…</span>}
      <button type="button" disabled={saving} aria-label={`Сохранить комментарий ${incident.number}`} title="Сохранить" onMouseDown={event => event.preventDefault()} onClick={() => void save(Boolean(conflict))}><Check size={16} />{conflict && "Заменить комментарий"}</button>
      <button type="button" disabled={saving} aria-label={`Отменить комментарий ${incident.number}`} title="Отмена" onMouseDown={event => event.preventDefault()} onClick={cancel}><X size={16} /></button>
    </div>
    {error && <p role="alert">{error}</p>}
  </div>
}
