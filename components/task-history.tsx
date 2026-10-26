"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { useApp } from "@/contexts/app-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { displayTime, displayDays, type TrackerEvent, type StageMetrics } from "@/lib/tracker-types";
import { simpleHistory, STATUS_TONES } from "@/lib/tracker-presentation";
import { normalizeStatusLabel, type TaskStatus } from "@/lib/types";

const stageDuration = (ms: number) => ms < 86400000 ? "< 1 дн." : displayDays(ms);

export function TaskHistory({ taskId, open, onClose }: { taskId: number; open: boolean; onClose: () => void }) {
  const { settings } = useApp();
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [metrics, setMetrics] = useState<StageMetrics | null>(null);
  const [error, setError] = useState(""), [stageError, setStageError] = useState(false), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true); setError(""); setStageError(false);
    Promise.allSettled([
      request<TrackerEvent[]>(`/tasks/${taskId}/events`),
      request<StageMetrics>(`/tasks/${taskId}/stages`),
    ]).then(([history, stages]) => {
      if (!live) return;
      if (history.status === "fulfilled") setEvents(history.value);
      else { setEvents([]); setError("Не удалось загрузить историю"); }
      if (stages.status === "fulfilled") setMetrics(stages.value);
      else { setMetrics(null); setStageError(true); }
      setLoading(false);
    });
    return () => { live = false; };
  }, [taskId, open]);
  const visible = simpleHistory(events);
  // Completion is a terminal state, so time after completion is not a work stage.
  const stages = Object.entries(metrics?.stages || {}).filter(([status, stage]) => status !== "завершена" && stage.milliseconds > 0);
  const total = stages.reduce((sum, [, stage]) => sum + stage.milliseconds, 0);
  const value = (field: string, v: unknown) => {
    if (v == null || v === "") return field === "status" ? "—" : "Не назначен";
    if (field === "assignee_user_id") return settings.executors.find(e => e.id === Number(v))?.name || `#${v}`;
    return field === "status" ? normalizeStatusLabel(String(v)) : String(v);
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
    <DialogContent className="history-modal">
      <DialogHeader>
        <DialogTitle>История изменений · #{taskId}</DialogTitle>
        <DialogDescription className="sr-only">Изменения статуса и исполнителя</DialogDescription>
      </DialogHeader>
      <div className="event-list">
        {loading ? <p role="status">Загрузка…</p> : <>
          {stageError && <p role="alert">Не удалось загрузить шкалу статусов.</p>}
          {!!stages.length && <section className="history-stages" aria-label="Время в статусах SimpleTracker">
            <div className="history-stages-heading"><b>Время в статусах</b>{metrics && !metrics.complete && <small>История неполная</small>}</div>
            <div className="history-stage-track" role="img" aria-label={stages.map(([status, stage]) => `${status}: ${stageDuration(stage.milliseconds)}`).join(", ")}>
              {stages.map(([status, stage]) => <span key={status} title={`${status} · ${stageDuration(stage.milliseconds)}`} style={{ width: `${stage.milliseconds / total * 100}%`, background: STATUS_TONES[status as TaskStatus] || "#979186" }} />)}
            </div>
            <div className="history-stage-legend">{stages.map(([status, stage]) => <span key={status}><i style={{ background: STATUS_TONES[status as TaskStatus] || "#979186" }} />{status}<b>{stageDuration(stage.milliseconds)}</b></span>)}</div>
          </section>}
          {!stages.length && !stageError && <p className="muted">Время в статусах пока неизвестно.</p>}
          {error && <p role="alert">{error}</p>}
          {visible.map(event => <article className="event-row simple-event" key={event.id}>
            <small>{event.occurred_at ? displayTime(event.occurred_at) : "Дата неизвестна"}{event.actor_name ? ` · ${event.actor_name}` : ""}</small>
            {Object.entries(event.changes).map(([field, change]) => <p key={field}>
              <span className="event-field">{field === "status" ? "Статус" : "Исполнитель"}{event.source === "jira" ? " Jira" : ""}</span>
              {change.old == null && field === "status" ? null : <><span>{value(field, change.old)}</span><span aria-hidden="true"> → </span></>}
              <strong>{value(field, change.new)}</strong>
            </p>)}
          </article>)}
          {!visible.length && !error && <p>Изменений статуса или исполнителя пока нет.</p>}
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
