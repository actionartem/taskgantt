"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { displayTime, type AnalysisStatistics, type AnalysisCycle } from "@/lib/tracker-types";

const day = (ms: number | null) => ms == null ? "—" : ms === 0 ? "0" : ms < 288000 ? "< 0,01" : (ms / 28800000).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const states: Record<AnalysisCycle["state"], string> = { approved: "Согласовано", returned: "Новые замечания", stopped: "Дальше вручную", customer: "У заказчика", working: "В работе", waiting: "Ждёт аналитика" };
const factLabels: Record<string,string> = { comments_received: "Замечания заказчика", document_sent: "АЗ отправлена заказчику", approval_received: "Финальное согласование" };
function cycleFacts(cycle:AnalysisCycle, jiraUrl?:string) {
  return [
    ...cycle.facts.map(f=>({...f,label:factLabels[f.type] || f.type})),
    ...(cycle.started_at ? [{type:"started",at:cycle.started_at,label:"В работе у аналитика",actor:cycle.started_by ? `Переход выполнил: ${cycle.started_by}` : null,url:jiraUrl}] : []),
    ...(cycle.jira_approval_at ? [{type:"jira_approval",at:cycle.jira_approval_at,label:"В Jira — на согласовании",actor:null,url:jiraUrl}] : []),
  ].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
}

export function AnalysisStatisticsModal({taskId,open,onClose}: {taskId:number;open:boolean;onClose:()=>void}) {
  const [data,setData] = useState<AnalysisStatistics | null>(null), [error,setError] = useState(""), [loading,setLoading] = useState(false), [retry,setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true); setError(""); setData(null);
    request<AnalysisStatistics>(`/tasks/${taskId}/analysis`).then(value => { if(live)setData(value); })
      .catch(e => { if(live)setError(e instanceof Error ? e.message : "Не удалось загрузить статистику"); })
      .finally(() => { if(live)setLoading(false); });
    return () => { live = false; };
  }, [taskId,open,retry]);
  return <Dialog open={open} onOpenChange={value => { if(!value)onClose(); }}>
    <DialogContent className="history-modal analysis-modal">
      <DialogHeader>
        <DialogTitle>Статистика АЗ · #{taskId}</DialogTitle>
        <DialogDescription>Рабочие дни · 10:00–19:00 МСК · 8 часов в день</DialogDescription>
      </DialogHeader>
      <div className="analysis-content">
        {loading && <p role="status">Загрузка…</p>}
        {error && <p className="tracker-error" role="alert">{error} <button type="button" onClick={() => setRetry(v=>v+1)}>Повторить</button></p>}
        {data && <>
          <div className="analysis-meta">
            {data.az ? <a href={data.az.url} target="_blank" rel="noreferrer">АЗ {data.az.issue_key} ↗</a> : <span>Задача АЗ ещё не привязана</span>}
            {data.blocked_reason && <span className="analysis-state">Дальше вручную</span>}
          </div>
          {data.cycles.length ? <>
            <div className="analysis-summary">
              <div><span>До взятия в работу</span><strong>{day(data.summary.average_wait_ms)}</strong><small>в среднем · {data.summary.measured_waits} циклов</small></div>
              <div><span>Аналитика</span><strong>{day(data.summary.analysis_ms)}</strong><small>всего рабочих дней</small></div>
              <div><span>Ревью</span><strong>{day(data.summary.review_ms)}</strong><small>всего рабочих дней</small></div>
              <div><span>У заказчика</span><strong>{day(data.summary.approval_ms)}</strong><small>всего рабочих дней</small></div>
            </div>
            <div className="analysis-cycles">
              {data.cycles.map((cycle,index) => <section className="analysis-cycle" key={cycle.id}>
                <div className="analysis-cycle-heading"><b>Цикл {data.cycles.length-index}</b><span>{states[cycle.state]}</span></div>
                <div className="analysis-flow">
                  <div><small>Замечания → в работу</small><b>{day(cycle.waiting_ms)} <small>раб. дн.</small></b></div>
                  <div><small>Аналитика</small><b>{day(cycle.analysis_ms)} <small>раб. дн.</small></b></div>
                  <div><small>Ревью</small><b>{day(cycle.review_ms)} <small>раб. дн.</small></b></div>
                  <div><small>У заказчика</small><b>{day(cycle.approval_ms)} <small>раб. дн.</small></b></div>
                </div>
                {cycle.sent_at && <p className="analysis-status-lag">От отправки АЗ до «На согласовании» в Jira: <b>{cycle.jira_approval_at ? `${day(cycle.jira_approval_delay_ms)} раб. дн.` : "переход не подтверждён"}</b></p>}
                <details>
                  <summary>Даты и источники{cycle.incomplete ? " · история неполная" : ""}</summary>
                  <ol className="analysis-facts">
                    {cycleFacts(cycle,data.az?.url).map(f=><li key={f.type}><time>{displayTime(f.at)}</time>{f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.label} ↗</a> : <span>{f.label}</span>}{f.actor && <small>{f.actor}</small>}</li>)}
                  </ol>
                </details>
              </section>)}
            </div>
          </> : <p className="analysis-empty">Нет подтверждённых циклов замечаний и согласования.</p>}
          {data.az?.checked_at && <small className="muted">Jira проверена {displayTime(data.az.checked_at)}</small>}
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
