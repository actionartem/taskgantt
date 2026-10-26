"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useApp } from "@/contexts/app-context";
import {
  STATUS_COLORS,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/types";
import { generateTaskId, validateTaskId } from "@/lib/task-utils";
import { TaskDetails } from "./tracker-views";
import { nextAction } from "@/lib/tracker-presentation";
import { displayTime } from "@/lib/tracker-types";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
const empty = (): Task => ({
  id: generateTaskId(),
  title: "",
  description: "",
  emailThread: "",
  documentHistory: "",
  status: "не в работе",
  priority: "средний",
  tags: [],
  statusLog: [],
  assigneeId: null,
  startDate: "",
  endDate: "",
  approvedHours: null,
  link: "",
  deadlineConfirmed: false,
  nextActionAt: null,
  nextActionText: "",
  replyDueAt: null,
  waitingFor: "",
});
const normalize = (v: unknown) =>
  v == null || v === "" ? null : Array.isArray(v) ? [...v].sort() : v;
export function TaskForm({
  task,
  open,
  onClose,
}: {
  task?: Task;
  open: boolean;
  onClose: () => void;
}) {
  const { settings, addTask, updateTask, deleteTask } = useApp();
  const [draft, setDraft] = useState<Task>(empty),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const initial = useRef<Task>(draft),
    openedId = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const key = task ? String(task.id) : "new";
    if (openedId.current === key) return;
    const value = task ? { ...empty(), ...task } : empty();
    initial.current = value;
    setDraft(value);
    setDirty(false);
    setError("");
    setDiscardOpen(false);
    openedId.current = key;
  }, [open, task]);
  const set = <K extends keyof Task>(key: K, value: Task[K]) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setDirty(true);
  };
  const close = () => {
    if (saving) return;
    if (dirty) { setDiscardOpen(true); return; }
    openedId.current = null;
    onClose();
  };
  const actionText = nextAction(draft);
  const actionDate = draft.nextActionAt || draft.replyDueAt;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!validateTaskId(draft.id)) {
      setError("ID должен быть 5-значным числом");
      return;
    }
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      setError("Начало не может быть позже окончания");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (task) {
        const changes: Partial<Task> = {};
        for (const key of Object.keys(draft) as Array<keyof Task>) {
          if (["id", "statusLog", "assigneeName"].includes(key)) continue;
          if (
            JSON.stringify(normalize(draft[key])) !==
            JSON.stringify(normalize(initial.current[key]))
          )
            (changes as Record<string, unknown>)[key] = draft[key];
        }
        await updateTask(task.id, changes);
      } else await addTask(draft);
      setDirty(false);
      openedId.current = null;
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось сохранить. Черновик остался в форме.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent
        className="task-form-modal"
        showCloseButton={!saving}
        onPointerDownOutside={(e) => { if (saving) e.preventDefault(); }}
        onEscapeKeyDown={(e) => {
          if (saving) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {task ? `Задача #${task.id}` : "Новая задача"}
          </DialogTitle>
          <DialogDescription className="sr-only">Карточка задачи</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="task-editor">
          <fieldset disabled={saving}>
            <div className="form-grid">
              <label>
                ID
                <input
                  type="number"
                  value={draft.id}
                  disabled={!!task}
                  min="10000"
                  max="99999"
                  required
                  onChange={(e) => set("id", Number(e.target.value))}
                />
              </label>
              <label>
                Приоритет
                <select
                  value={draft.priority}
                  onChange={(e) =>
                    set("priority", e.target.value as TaskPriority)
                  }
                >
                  {["низкий", "средний", "высокий"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Название
              <input
                value={draft.title}
                required
                maxLength={1000}
                onChange={(e) => set("title", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Статус SimpleTracker
                <select
                  value={draft.status}
                  onChange={(e) => set("status", e.target.value as TaskStatus)}
                >
                  {Object.keys(STATUS_COLORS).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Ответственный SimpleTracker
                <select
                  value={draft.assigneeId ?? ""}
                  onChange={(e) =>
                    set(
                      "assigneeId",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">Не назначен</option>
                  {settings.executors.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Начало
                <input
                  type="date"
                  value={draft.startDate || ""}
                  onChange={(e) => set("startDate", e.target.value || null)}
                />
              </label>
              <label>
                Плановая дата релиза
                <input
                  type="date"
                  value={draft.endDate || ""}
                  onChange={(e) => { set("endDate", e.target.value || null); if (!e.target.value) set("deadlineConfirmed", false); }}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Согласовано, ч
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="1000000"
                  value={draft.approvedHours ?? ""}
                  placeholder="Неизвестно"
                  onChange={(e) =>
                    set(
                      "approvedHours",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
            </div>
            <label>
              Описание
              <textarea
                rows={3}
                value={draft.description || ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>
            <label>
              Ссылка на задачу
              <input
                type="url"
                value={draft.link || ""}
                onChange={(e) => set("link", e.target.value)}
              />
            </label>
            <label>
              Почтовая переписка
              <textarea
                rows={2}
                value={draft.emailThread || ""}
                onChange={(e) => set("emailThread", e.target.value)}
              />
            </label>
            <div>
              <span className="field-label">Теги</span>
              <div className="tag-buttons">
                {settings.tags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={draft.tags.includes(t)}
                    onClick={() =>
                      set(
                        "tags",
                        draft.tags.includes(t)
                          ? draft.tags.filter((x) => x !== t)
                          : [...draft.tags, t],
                      )
                    }
                  >
                    {t}
                  </button>
                ))}
                {!settings.tags.length && (
                  <span className="muted">Добавьте теги в настройках.</span>
                )}
              </div>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="tracker-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            {task && (
              <button
                type="button"
                className="delete-task"
                disabled={saving}
                onClick={() => {
                  if (window.confirm(`Удалить задачу #${task.id}?`)) {
                    setSaving(true);
                    void deleteTask(task.id)
                      .then(() => {
                        openedId.current = null;
                        onClose();
                      })
                      .catch((e) => setError(String(e.message)))
                      .finally(() => setSaving(false));
                  }
                }}
              >
                Удалить
              </button>
            )}
            <button type="button" disabled={saving} onClick={close}>
              Отмена
            </button>
            <button type="submit" className="accent-button" disabled={saving}>
              {saving ? "Сохраняю…" : task ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
        {actionText && <div className="automatic-next-action"><span>Следующее действие</span><b>{actionText}</b>{actionDate && <small>{displayTime(actionDate)}</small>}</div>}
        {task && <TaskDetails key={task.id} taskId={task.id} />}
        <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>Закрыть без сохранения?</AlertDialogTitle>
            <AlertDialogDescription>Изменения карточки будут потеряны.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Продолжить редактирование</AlertDialogCancel>
              <AlertDialogAction onClick={() => { openedId.current = null; onClose(); }}>Закрыть без сохранения</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
