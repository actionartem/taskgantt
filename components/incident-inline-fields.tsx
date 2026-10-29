"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, LoaderCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ApiError, request } from "@/lib/api"
import { INCIDENT_PRIORITIES, incidentDateTime, incidentInputTime, incidentInstant, type Incident, type IncidentInput, type IncidentPriority } from "@/lib/incidents"

type Props = { incident: Incident; canEdit: boolean; onSaved: (incident: Incident) => void; onEditingChange: (key: string, editing: boolean) => void }
type TimingField = "expires_at" | "is_deferred" | "deferred_until"
type Patch = Partial<Pick<IncidentInput, "priority" | TimingField>>
const errorText = (error: unknown) => error instanceof Error ? error.message : "Не удалось сохранить изменения"

function useInlineSave({ incident, onSaved, onEditingChange }: Props, key: string) {
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("")
  const alive = useRef(true), pending = useRef(false)
  useEffect(() => { onEditingChange(key, open || saving) }, [key, open, saving, onEditingChange])
  useEffect(() => { alive.current = true; return () => { alive.current = false; onEditingChange(key, false) } }, [key, onEditingChange])
  const save = async (patch: Patch) => {
    if (pending.current) return
    pending.current = true; setSaving(true); setError("")
    try {
      const result = await request<Incident>(`/incidents/${incident.id}/fields`, { method: "PATCH", body: JSON.stringify({ ...patch, version: incident.version }) })
      onSaved(result)
      if (alive.current) setOpen(false)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        // Refresh the row without replaying a conflicting edit.
        try {
          const latest = (await request<{ items: Incident[] }>("/incidents")).items.find(row => row.id === incident.id)
          if (latest) onSaved(latest)
        } catch { /* Keep the original save error and the user's draft. */ }
      }
      if (alive.current) setError(errorText(cause))
    } finally { pending.current = false; if (alive.current) setSaving(false) }
  }
  return { open, setOpen, saving, error, setError, save }
}

export function IncidentPriorityField(props: Props) {
  const { incident, canEdit } = props
  const state = useInlineSave(props, `priority:${incident.id}`)
  if (!canEdit) return <span className={`incident-priority priority-${incident.priority}`}>{INCIDENT_PRIORITIES[incident.priority]}</span>
  return <span className="incident-inline-field" data-incident-control>
    <DropdownMenu open={state.open} onOpenChange={state.setOpen}><DropdownMenuTrigger asChild><button type="button" className={`incident-priority incident-priority-trigger priority-${incident.priority}`} disabled={state.saving} aria-label={`Приоритет ${incident.number}`}>{INCIDENT_PRIORITIES[incident.priority]}{state.saving ? <LoaderCircle className="itsm-spinner" size={12} /> : <ChevronDown size={12} />}</button></DropdownMenuTrigger>
      <DropdownMenuContent className="incident-priority-menu" align="start" data-incident-control onClick={event => event.stopPropagation()}><DropdownMenuRadioGroup value={incident.priority} onValueChange={value => { if (value !== incident.priority) void state.save({ priority: value as IncidentPriority }) }}>
        {Object.entries(INCIDENT_PRIORITIES).map(([value, label]) => <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup></DropdownMenuContent>
    </DropdownMenu>
    {state.error && <span className="incident-inline-error" role="alert">{state.error}</span>}
  </span>
}

export function IncidentTimingField(props: Props & { field: TimingField }) {
  const { incident, canEdit, field } = props
  const state = useInlineSave(props, `${field}:${incident.id}`)
  const [expires, setExpires] = useState(""), [deferred, setDeferred] = useState(false), [until, setUntil] = useState("")
  const input = useRef<HTMLInputElement>(null), untilInput = useRef<HTMLInputElement>(null)
  const label = field === "expires_at" ? "Дата сгорания" : field === "deferred_until" ? "Отложен до" : "Отложен"
  const content = field === "is_deferred" ? <span className="incident-check"><span className={`incident-check-box${incident.is_deferred ? " is-checked" : ""}`} aria-hidden="true">{incident.is_deferred && <Check size={12} />}</span>{incident.is_deferred ? "Да" : "Нет"}</span>
    : field === "deferred_until" && !incident.deferred_until ? "—" : <time dateTime={field === "expires_at" ? incident.expires_at : incident.deferred_until!}>{incidentDateTime(field === "expires_at" ? incident.expires_at : incident.deferred_until!)}</time>
  if (!canEdit) return <>{content}</>
  const open = (value: boolean) => {
    if (state.saving) return
    if (value) {
      setExpires(incidentInputTime(incident.expires_at)); setDeferred(incident.is_deferred || field !== "expires_at")
      setUntil(incident.deferred_until ? incidentInputTime(incident.deferred_until) : ""); state.setError("")
    }
    state.setOpen(value)
  }
  return <span className="incident-inline-field" data-incident-control>
    <Popover open={state.open} onOpenChange={open}><PopoverTrigger asChild><button type="button" className="incident-inline-trigger" aria-label={`${label} ${incident.number}`}>{content}</button></PopoverTrigger>
      <PopoverContent className="incident-timing-popover" align="start" sideOffset={6} data-incident-control aria-label={`Сроки инцидента ${incident.number}`} onClick={event => event.stopPropagation()}
        onOpenAutoFocus={event => { event.preventDefault(); (field !== "expires_at" && untilInput.current ? untilInput.current : input.current)?.focus() }} onEscapeKeyDown={event => { if (state.saving) event.preventDefault() }} onInteractOutside={event => { if (state.saving) event.preventDefault() }}>
        <form onSubmit={event => { event.preventDefault(); if (!expires || (deferred && !until)) return; if (deferred && until <= expires) { state.setError("Новый срок должен быть позже исходной даты сгорания"); return }; void state.save({ expires_at: incidentInstant(expires), is_deferred: deferred, deferred_until: deferred ? incidentInstant(until) : null }) }}>
          <fieldset disabled={state.saving}><label>Дата сгорания<input ref={input} aria-label="Дата сгорания" type="datetime-local" required min="2000-01-01T00:00" max="2100-12-31T23:59" value={expires} onInput={event => { setExpires(event.currentTarget.value); state.setError("") }} onChange={event => { setExpires(event.target.value); state.setError("") }} /></label>
            <label className="incident-check"><input type="checkbox" checked={deferred} onChange={event => { setDeferred(event.target.checked); state.setError("") }} />Отложен</label>
            {deferred && <label>Отложен до<input ref={untilInput} aria-label="Отложен до" type="datetime-local" required min={expires || "2000-01-01T00:00"} max="2100-12-31T23:59" value={until} onInput={event => { setUntil(event.currentTarget.value); state.setError("") }} onChange={event => { setUntil(event.target.value); state.setError("") }} /></label>}
          </fieldset>
          {state.error && <p className="incident-inline-error" role="alert">{state.error}</p>}
          <div className="incident-inline-actions"><button type="button" disabled={state.saving} onClick={() => state.setOpen(false)}>Отмена</button><button type="submit" disabled={state.saving}>{state.saving ? <LoaderCircle className="itsm-spinner" size={14} /> : null}{state.saving ? "Сохранение…" : "Сохранить"}</button></div>
        </form>
      </PopoverContent>
    </Popover>
  </span>
}
