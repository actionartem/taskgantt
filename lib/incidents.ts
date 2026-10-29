export type IncidentPriority = "low" | "medium" | "high"
export type IncidentInput = {
  number: string
  jira_url: string
  priority: IncidentPriority
  expires_at: string
  is_deferred: boolean
  deferred_until: string | null
  comment?: string
}
export type Incident = IncidentInput & {
  id: string
  version: number
  created_at: string
  updated_at: string
  status?: "active" | "completed" | "burned"
  closed_at?: string | null
  closure_source?: "manual" | "itsm" | null
  closure_deadline_at?: string | null
  itsm_completed_at?: string | null
  itsm_created_at?: string | null
  archive_initial?: boolean
  itsm_deadline_at?: string | null
  last_checked_at?: string | null
  check_error?: string | null
}
export const INCIDENT_PRIORITIES: Record<IncidentPriority, string> = {
  low: "Низкий", medium: "Средний", high: "Высокий",
}
export const incidentItsmUrl = (number: string) => /^[1-9]\d{0,14}$/.test(number) ? `https://sc-echd.itsm.mos.ru/requests/${number}` : null
export function compareIncidentCreation(a: Incident, b: Incident) {
  const first = a.itsm_created_at ? Date.parse(a.itsm_created_at) : NaN
  const second = b.itsm_created_at ? Date.parse(b.itsm_created_at) : NaN
  if (Number.isFinite(first) && Number.isFinite(second) && first !== second) return second - first
  if (Number.isFinite(first) !== Number.isFinite(second)) return Number.isFinite(first) ? -1 : 1
  return b.number.localeCompare(a.number, "ru", { numeric: true }) || b.id.localeCompare(a.id, "en", { numeric: true })
}
export function compareArchivedIncidents(a: Incident, b: Incident) {
  if (Boolean(a.archive_initial) !== Boolean(b.archive_initial)) return a.archive_initial ? 1 : -1
  if (a.archive_initial) return compareIncidentCreation(a, b)
  const first = a.closed_at ? Date.parse(a.closed_at) : NaN
  const second = b.closed_at ? Date.parse(b.closed_at) : NaN
  if (Number.isFinite(first) && Number.isFinite(second) && first !== second) return second - first
  if (Number.isFinite(first) !== Number.isFinite(second)) return Number.isFinite(first) ? -1 : 1
  return b.id.localeCompare(a.id, "en", { numeric: true })
}
const moscowDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", calendar: "gregory", numberingSystem: "latn" })
const moscowTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const displayTime = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
export const incidentDeadline = (incident: IncidentInput) => incident.is_deferred ? incident.deferred_until! : incident.expires_at
export const incidentDay = (instant: string | Date) => {
  const parts = moscowDay.formatToParts(new Date(instant))
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part("year")}-${part("month")}-${part("day")}`
}
export const incidentDateTime = (instant: string) => displayTime.format(new Date(instant))
export const incidentInputTime = (instant: string) => `${incidentDay(instant)}T${moscowTime.format(new Date(instant))}`
export const incidentInstant = (value: string) => new Date(`${value}:00+03:00`).toISOString()
export function incidentMonthDays(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`)
  const offset = (start.getUTCDay() + 6) % 7
  start.setUTCDate(1 - offset)
  return Array.from({ length: 42 }, (_, index) => new Date(+start + index * 86400000).toISOString().slice(0, 10))
}
export function shiftIncidentMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}
