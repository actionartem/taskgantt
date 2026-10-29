"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request, downloadDocument } from "@/lib/api";
import type { TaskDocument } from "@/lib/tracker-types";
import { useApp } from "@/contexts/app-context";

export function DownloadLink({ doc }: { doc: TaskDocument }) {
  const [error, setError] = useState("");
  return <div>{doc.file_name ? <button type="button" onClick={() => void downloadDocument(doc).catch(e => setError(e.message))}>Скачать ↗</button> : doc.source_url ? <a href={doc.source_url} target="_blank" rel="noopener noreferrer">Открыть ↗</a> : null}{error && <span role="alert">{error}</span>}</div>;
}

export function ApprovedDocument({ taskId, readOnly = false }: { taskId: number; readOnly?: boolean }) {
  const { refreshFromApi } = useApp();
  const [doc, setDoc] = useState<TaskDocument | null>(null), [loading, setLoading] = useState(true);
  const [upload, setUpload] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [title, setTitle] = useState(""), [approvedDate, setApprovedDate] = useState(""), [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const key = useRef<{ id: string; at: string } | null>(null);
  const load = useCallback(async () => {
    const docs = await request<TaskDocument[]>(`/tasks/${taskId}/documents?latest=approved`);
    setDoc(docs[0] || null);
  }, [taskId]);
  useEffect(() => {
    let live = true;
    request<TaskDocument[]>(`/tasks/${taskId}/documents?latest=approved`).then(d => { if (live) setDoc(d[0] || null); })
      .catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [taskId]);
  const resetKey = () => { key.current = null; };
  const save = async () => {
    if (readOnly) return;
    setBusy(true); setError("");
    try {
      if (file && file.size > 10485760) throw new Error("Максимальный размер файла — 10 МБ");
      const file_base64 = file ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Не удалось прочитать файл")); reader.readAsDataURL(file);
      }) : undefined;
      const event = key.current ??= { id: crypto.randomUUID(), at: new Date().toISOString() };
      await request(`/tasks/${taskId}/documents/approved`, { method: "POST", body: JSON.stringify({
        event: { external_id: event.id, type: "document.approved", summary: `Добавлен согласованный документ: ${title}`, occurred_at: event.at },
        document: { title, approved_at: new Date(approvedDate + "T00:00:00").toISOString(), approval_evidence: "Загружен пользователем как согласованный", source_url: link || null, file_name: file?.name, file_base64 },
      }) });
      await load(); setUpload(false); setFile(null); setTitle(""); setLink(""); setApprovedDate(""); resetKey();
      void refreshFromApi().catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить документ"); }
    finally { setBusy(false); }
  };
  return <details open className="approved-document"><summary>Согласованный документ</summary>
    <div className="approved-document-content">{loading ? <p role="status">Загрузка…</p> : doc ? <article className="document-compact"><b>{doc.title}</b><small>{doc.approved_at ? `Согласован ${new Date(doc.approved_at).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}` : "Согласован; дата согласования неизвестна"}</small><DownloadLink doc={doc} /></article> : <p className="muted">Документ не добавлен</p>}</div>
    {error && <p role="alert" className="tracker-error">{error}</p>}
    {!readOnly && !upload && <button type="button" onClick={() => setUpload(true)}>{doc ? "Заменить документ" : "Добавить документ"}</button>}
    {!readOnly && upload && <fieldset disabled={busy} className="document-upload form-grid">
      <label>Файл<input type="file" accept=".pdf,.doc,.docx,.docm,.xls,.xlsx,.txt,.png,.jpg,.jpeg" onChange={e => { const f = e.target.files?.[0] || null; setFile(f); if (f && !title) setTitle(f.name); resetKey(); }} /></label>
      <label>Ссылка<input type="url" value={link} onChange={e => { setLink(e.target.value); resetKey(); }} /></label>
      <label>Название<input value={title} onChange={e => { setTitle(e.target.value); resetKey(); }} /></label>
      <label>Дата согласования<input type="date" value={approvedDate} onChange={e => { setApprovedDate(e.target.value); resetKey(); }} /></label>
      <button type="button" disabled={busy || !title.trim() || !approvedDate || (!file && !link)} onClick={() => void save()}>{busy ? "Сохранение…" : "Сохранить документ"}</button>
      <button type="button" disabled={busy} onClick={() => setUpload(false)}>Отмена</button>
    </fieldset>}
  </details>;
}
