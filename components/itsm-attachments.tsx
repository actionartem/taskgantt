"use client"

import { useEffect, useRef, useState } from "react"
import { Download, ExternalLink, File, FileCode2, FileSpreadsheet, FileText, ChevronDown, LoaderCircle, ZoomIn } from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { httpLink } from "@/lib/itsm"
import { attachmentSize, attachmentText, canPreviewAttachment, findAttachment, inlineAttachments, normalizeAttachments, readAttachment, rehypeItsmAttachments, type ItsmAttachment } from "@/lib/itsm-attachments"

const schema = { ...defaultSchema, tagNames: [...(defaultSchema.tagNames || []), "details", "summary"], attributes: { ...defaultSchema.attributes, details: ["open"] } }
const origin = () => typeof window === "undefined" ? undefined : window.location.origin

function DownloadAttachment({ file }: { file: ItsmAttachment }) {
  const [loading, setLoading] = useState(false), [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const download = async () => {
    if (!file.url || loading) return
    const current = new AbortController(); controller.current = current
    setLoading(true); setError("")
    try {
      const { bytes } = await readAttachment(file.url, 64 * 1024 * 1024, AbortSignal.any([current.signal, AbortSignal.timeout(60000)]))
      if (current.signal.aborted) return
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" }))
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { if (!current.signal.aborted) setError("Не удалось скачать файл. Откройте оригинал или запросите сведения заново") }
    finally { if (!current.signal.aborted) setLoading(false) }
  }
  if (!file.url) return null
  return <span className="itsm-file-download">
    {canPreviewAttachment(file.url, origin()) ? <button type="button" className="itsm-file-action" disabled={loading} title="Скачать" aria-label={`Скачать ${file.name}`} onClick={() => void download()}>{loading ? <LoaderCircle className="itsm-spinner" size={16} /> : <Download size={16} />}</button>
      : <a className="itsm-file-action" href={file.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Открыть ${file.name}`} title="Открыть"><ExternalLink size={16} /></a>}
    {error && <span className="itsm-file-error" role="alert">{error}</span>}
  </span>
}

function AttachmentImage({ file }: { file: ItsmAttachment }) {
  const [expanded, setExpanded] = useState(false), [failed, setFailed] = useState(false)
  if (!file.url) return <span className="itsm-empty">{file.name} · Недоступно</span>
  return <span className="itsm-image-card">
    {failed ? <span className="itsm-file-error">Не удалось загрузить изображение</span> : <button type="button" className="itsm-image-preview" onClick={() => setExpanded(true)} aria-label={`Увеличить ${file.name}`}><img src={file.url} alt={file.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /><span className="itsm-image-zoom"><ZoomIn size={17} /></span></button>}
    <span className="itsm-file-caption"><a href={file.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{file.name}</a><small>{attachmentSize(file.size)}</small><DownloadAttachment file={file} /></span>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="itsm-image-dialog"><DialogHeader><DialogTitle>{file.name}</DialogTitle><DialogDescription className="sr-only">Просмотр изображения</DialogDescription></DialogHeader><div className="itsm-image-full"><img src={file.url} alt={file.name} referrerPolicy="no-referrer" /></div><div className="itsm-image-toolbar"><a href={file.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink size={15} />Открыть оригинал</a><DownloadAttachment file={file} /></div></DialogContent></Dialog>
  </span>
}

function TextAttachment({ file }: { file: ItsmAttachment }) {
  const [open, setOpen] = useState(false), [text, setText] = useState<string | null>(null), [loading, setLoading] = useState(false)
  const [truncated, setTruncated] = useState(false), [error, setError] = useState("")
  useEffect(() => {
    if (!open || !file.url || !canPreviewAttachment(file.url, origin())) return
    const controller = new AbortController()
    setLoading(true); setError("")
    void readAttachment(file.url, 512 * 1024, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), true)
      .then(result => { if (!controller.signal.aborted) { setText(attachmentText(result.bytes, result.contentType)); setTruncated(result.truncated) } })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить текст. Можно открыть оригинал") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [open, file.url])
  return <div className="itsm-file-card"><div className="itsm-file-heading"><button type="button" className="itsm-file-name" aria-expanded={open} onClick={() => setOpen(value => !value)}><FileText size={19} /><span>{file.name}</span><ChevronDown size={15} className={open ? "is-open" : ""} /></button><small>{attachmentSize(file.size)}</small><DownloadAttachment file={file} /></div>
    {open && <div className="itsm-text-preview">{loading ? <span role="status"><LoaderCircle className="itsm-spinner" size={16} />Загрузка…</span> : error ? <p className="itsm-file-error" role="alert">{error}</p> : text !== null ? <><pre>{text || "Пустой файл"}</pre>{truncated && <p>Показано начало файла · Полный текст доступен при скачивании</p>}</> : null}{file.url && <a href={file.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Открыть оригинал</a>}</div>}
  </div>
}

function AttachmentCard({ file }: { file: ItsmAttachment }) {
  if (file.kind === "image" && canPreviewAttachment(file.url, origin())) return <AttachmentImage file={file} />
  if (file.kind === "text" && canPreviewAttachment(file.url, origin())) return <TextAttachment file={file} />
  const extension = file.name.split(".").pop()?.toLowerCase()
  const Icon = ["xls", "xlsx", "csv", "ods"].includes(extension || "") ? FileSpreadsheet : ["xml", "json"].includes(extension || "") ? FileCode2 : File
  return <div className="itsm-file-card"><div className="itsm-file-heading"><Icon size={19} />{file.url ? <a className="itsm-file-name" href={file.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{file.name}</a> : <span className="itsm-file-name">{file.name}</span>}<small>{attachmentSize(file.size)}</small><DownloadAttachment file={file} /></div></div>
}

export function ItsmAttachmentList({ value, omit }: { value: unknown; omit?: Set<string> }) {
  const files = normalizeAttachments(value).filter(file => !omit?.has(file.id))
  return <div className="itsm-attachments">{files.map(file => <AttachmentCard key={file.id} file={file} />)}</div>
}

export function ItsmRichText({ text, attachmentData }: { text: unknown; attachmentData?: unknown }) {
  if (typeof text !== "string" || !text) return <p className="itsm-empty">Текст не указан</p>
  const attachments = normalizeAttachments(attachmentData)
  return <div className="itsm-rich-text"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeItsmAttachments, { attachments, localOrigin: origin() }], [rehypeSanitize, schema]]} components={{
    a: ({ href, children }) => httpLink(href) ? <a href={httpLink(href)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{children}</a> : <span>{children}</span>,
    img: ({ src, alt }) => {
      const url = httpLink(src)
      if (!url || !canPreviewAttachment(url, origin())) return <span>{alt || "Изображение недоступно"}</span>
      const file = findAttachment(url, attachments) || { id: url, name: alt || "Изображение", url, key: "", size: null, kind: "image" as const }
      return <AttachmentImage file={file} />
    },
  }}>{text}</Markdown></div>
}

export function remainingAttachments(text: unknown, attachmentData: unknown): Set<string> {
  return inlineAttachments(text, normalizeAttachments(attachmentData))
}
