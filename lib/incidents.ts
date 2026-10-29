export type IncidentPriority = "low" | "medium" | "high"
export type IncidentInput = {
  number: string
  jira_url: string
  priority: IncidentPriority
  expires_at: string
  is_deferred: boolean
  deferred_until: string | null
}
export type Incident = IncidentInput & {
  id: string
  version: number
  created_at: string
  updated_at: string
}
export const INCIDENT_PRIORITIES: Record<IncidentPriority, string> = {
  low: "Низкий", medium: "Средний", high: "Высокий",
}
const moscowDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" })
const moscowTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const displayTime = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
export const incidentDeadline = (incident: IncidentInput) => incident.is_deferred ? incident.deferred_until! : incident.expires_at
export const incidentDay = (instant: string | Date) => moscowDay.format(new Date(instant))
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
