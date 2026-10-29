export type AccessRole = "editor" | "viewer" | "incident_editor"
export const ACCESS_ROLE_LABELS: Record<AccessRole, string> = {
  editor: "Редактор задач и инцидентов",
  viewer: "Только чтение",
  incident_editor: "Поддержка — только инциденты",
}
export type AccessUser = { is_superadmin?: boolean; access_role?: AccessRole; role_text?: string | null }
export function permissionsFor(user: AccessUser | null) {
  if (!user) return { editTasks: false, editIncidents: false, manageUsers: false }
  if (user.is_superadmin) return { editTasks: true, editIncidents: true, manageUsers: true }
  const legacyReadOnly = /viewer|read-only|readonly|только чтение|просмотр|наблюдатель/i.test(user.role_text || "")
  const role = user.access_role ?? (legacyReadOnly ? "viewer" : "editor")
  return { editTasks: role === "editor", editIncidents: role === "editor" || role === "incident_editor", manageUsers: false }
}
