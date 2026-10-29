import type { Incident } from "./incidents"
export type ItsmRecord = Record<string, unknown>
export type ItsmSection = { title: string; items: ItsmRecord[]; complete: boolean; error: string | null; upstream_status: number | null }
export type ItsmSyncValues = { priority: "low" | "medium" | "high"; expires_at: string; is_deferred: boolean; deferred_until: string | null }
export type ItsmDetails = {
  record: ItsmRecord; sections: Record<string, ItsmSection>; checked_at: string; incident_version: number; incident: Incident
  synchronization: { values: ItsmSyncValues | null; error: string | null }
}

export const ITSM_STATUSES: Record<string, string> = {
  assigned: "Назначен", accepted: "Принят", in_progress: "В работе", waiting_for: "Ожидание",
  waiting_for_customer: "Ожидание заявителя", completed: "Завершён", declined: "Отклонён",
  on_backlog: "В очереди", workflow_pending: "Ожидание изменения", project_pending: "Ожидание проекта", reservation_pending: "Ожидание бронирования",
}
export const ITSM_LABELS: Record<string, string> = {
  id: "Номер", subject: "Тема", summary: "Описание", status: "Статус", category: "Категория", impact: "Важность", urgent: "Срочный",
  member: "Исполнитель", team: "Группа", service_instance: "Сервис", organization: "Организация", created_by: "Создал", requested_by: "Заявитель", requested_for: "Для кого",
  created_at: "Создан", updated_at: "Изменён", completed_at: "Завершён", completion_reason: "Причина завершения",
  resolution_target_at: "Срок решения", requester_resolution_target_at: "Срок для заявителя", response_target_at: "Срок реакции", next_target_at: "Следующий контрольный срок",
  waiting_until: "Ожидание до", desired_completion_at: "Желаемый срок", resolution_duration: "Решение, минут", assignment_count: "Число назначений", reopen_count: "Повторные открытия",
  downtime_start_at: "Начало простоя", downtime_end_at: "Конец простоя", downtime_duration: "Простой, минут", source: "Источник", sourceID: "Номер в источнике",
  ci: "Оборудование", cis: "Оборудование", ci_id: "Номер оборудования", problem: "Проблема", workflow: "Изменение", project: "Проект", task: "Задача", template: "Шаблон",
  grouped_into: "Объединён с обращением", grouping: "Группировка", supplier: "Поставщик", supplier_requestID: "Номер у поставщика",
  custom_fields: "Дополнительные поля", tags: "Метки", attachments: "Вложения", person: "Автор", text: "Текст", medium: "Канал", internal: "Внутренняя запись",
  name: "Название", account: "Пространство", label: "Обозначение", description: "Описание", localized_name: "Название", url: "Ссылка", download_url: "Скачать", source_url: "Источник", uri: "Ссылка",
  filename: "Файл", file_name: "Файл", content_type: "Тип файла", size: "Размер", file_size: "Размер", byte_size: "Размер", note: "Заметка", note_id: "Номер заметки",
  action: "Действие", changes: "Изменения", user: "Пользователь", nodeID: "Внутренний идентификатор", reviewed: "Проверен", addressed: "Обращение рассмотрено", satisfaction: "Оценка заявителя",
  major_incident_status: "Статус крупного инцидента", new_assignment: "Новое назначение", provider_not_accountable: "Ответственность поставщика приостановлена", provider_was_not_accountable: "Была приостановка ответственности",
  planned_effort: "Плановые трудозатраты", checked_items: "Выполненные пункты", knowledge_article: "Статья базы знаний", feedback_on_knowledge_article: "Отзыв о статье",
  agile_board: "Доска", agile_board_column: "Колонка доски", agile_board_column_position: "Позиция в колонке", product_backlog: "Бэклог", product_backlog_position: "Позиция в бэклоге", product_backlog_estimate: "Оценка бэклога", reservation: "Бронирование",
  sla: "SLA", accountability: "Ответственность", time_zone: "Часовой пояс", support_hours: "Часы поддержки", service_hours: "Часы обслуживания", support_team: "Группа поддержки", first_line_team: "Первая линия",
  stopped_clock_at: "Часы остановлены", stopped_clock_duration: "Приостановлено, минут", actual_response_at: "Фактическая реакция", actual_response_duration: "Реакция, минут", actual_resolution_at: "Фактическое решение", actual_resolution_duration: "Решение, минут",
  maximum_response_duration: "Норматив реакции, минут", maximum_resolution_duration: "Норматив решения, минут", started_at: "Начало", disabled: "Отключено",
  email: "Почта", email_address: "Почта", telephone: "Телефон", from: "Отправитель", to: "Получатель", received_at: "Получено", sent_at: "Отправлено", body: "Содержимое", content: "Содержимое",
}
export const itsmLabel = (key: string) => ITSM_LABELS[key] || key.replaceAll("_", " ")
export function entityName(value: unknown): string {
  if (value == null) return "Не указан"
  if (typeof value !== "object") return String(value)
  const item = value as ItsmRecord
  return String(item.name || item.subject || item.label || item.file_name || item.filename || item.id || "Запись")
}
export function httpLink(value: unknown): string | undefined {
  if (typeof value !== "string") return
  try { const url = new URL(value); if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href } catch { /* plain text */ }
}
