export type ItsmAttachment = {
  id: string; name: string; url: string | null; key: string; size: number | null
  kind: "image" | "text" | "file" | "link"
}
const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"])
const textExtensions = new Set(["txt", "log", "md"])
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
export function attachmentKey(value: string): string {
  let path = value
  try { path = new URL(value).pathname } catch { /* ITSM also supplies relative attachment keys. */ }
  try { path = decodeURIComponent(path) } catch { /* Keep malformed escapes literal. */ }
  return path.replace(/^\/?storage\//, "").replace(/^\/+/, "")
}
export function canPreviewAttachment(url: string | null, localOrigin?: string): boolean {
  if (!url || !safeUrl(url)) return false
  const parsed = new URL(url)
  return (parsed.origin === "https://assets.itsm.mos.ru" && parsed.pathname.startsWith("/storage/attachments/")) || parsed.origin === localOrigin
}
export function normalizeAttachments(value: unknown): ItsmAttachment[] {
  if (!Array.isArray(value)) return []
  const found = new Map<string, ItsmAttachment>()
  for (const item of value) {
    if (!item || (typeof item !== "string" && typeof item !== "object")) continue
    const record = typeof item === "string" ? { uri: item } : item as Record<string, unknown>
    const url = [record.uri, record.download_url, record.url, record.source_url].map(safeUrl).find(Boolean) || null
    let urlName = ""
    try { urlName = decodeURIComponent(new URL(url!).pathname.split("/").pop() || "") } catch { /* No usable URL. */ }
    const name = String(record.name || record.file_name || record.filename || urlName || "Вложение")
    const extension = name.split(".").pop()?.toLowerCase() || ""
    const mime = String(record.content_type || record.mime_type || "").toLowerCase()
    const key = attachmentKey(String(record.key || url || ""))
    const id = String(record.id || key || url || name)
    const size = typeof record.size === "number" && Number.isFinite(record.size) && record.size >= 0 ? record.size : null
    const kind = imageExtensions.has(extension) || /^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(mime) ? "image"
      : textExtensions.has(extension) || mime === "text/plain" ? "text" : typeof item === "string" ? "link" : "file"
    const attachment: ItsmAttachment = { id, name, url, key, size, kind }
    const old = found.get(id)
    if (!old || !old.url) found.set(id, attachment)
  }
  return [...found.values()]
}
export function findAttachment(source: string, attachments: ItsmAttachment[]): ItsmAttachment | undefined {
  const key = attachmentKey(source)
  return attachments.find(file => file.key === key || (file.url && attachmentKey(file.url) === key))
}
const markdownImage = /!\[([^\]\n]*)\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)(?:\{:[^}\n]*\})?/g
export function attachmentNotePreview(text: unknown): string {
  return String(text || "Заметка без текста").replace(new RegExp(markdownImage.source, "g"), "Изображение").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)
}
export function inlineAttachments(text: unknown, attachments: ItsmAttachment[]): Set<string> {
  const used = new Set<string>()
  if (typeof text !== "string") return used
  for (const match of text.matchAll(new RegExp(markdownImage.source, "g"))) {
    const file = findAttachment(match[2].replace(/^<|>$/g, ""), attachments)
    if (file?.kind === "image" && file.url) used.add(file.id)
  }
  for (const match of text.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const file = findAttachment(match[1], attachments)
    if (file?.kind === "image" && file.url) used.add(file.id)
  }
  return used
}
type HtmlNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HtmlNode[] }
// Run after rehype-raw and before sanitization. 4me embeds Markdown images inside HTML cells.
export function rehypeItsmAttachments({ attachments = [], localOrigin }: { attachments?: ItsmAttachment[]; localOrigin?: string } = {}) {
  const image = (source: string, alt: string): HtmlNode => {
    const file = findAttachment(source, attachments), url = file?.url || safeUrl(source)
    const raster = file ? file.kind === "image" : url && imageExtensions.has(new URL(url).pathname.split(".").pop()?.toLowerCase() || "")
    if (url && raster && canPreviewAttachment(url, localOrigin)) return { type: "element", tagName: "img", properties: { src: url, alt: alt || file?.name || "Изображение" }, children: [] }
    return url ? { type: "element", tagName: "a", properties: { href: url }, children: [{ type: "text", value: alt || file?.name || "Открыть изображение" }] }
      : { type: "text", value: file?.name || alt || "Изображение недоступно" }
  }
  const mediaOnly = (node: HtmlNode): boolean => node.tagName === "img" || (node.type === "text" ? !node.value?.trim()
    : ["p", "div", "span", "br"].includes(node.tagName || "") && (node.children || []).every(mediaOnly))
  const walk = (node: HtmlNode) => {
    if (["pre", "code", "script", "style"].includes(node.tagName || "")) return
    if (node.tagName === "img") {
      const replacement = image(String(node.properties?.src || ""), String(node.properties?.alt || ""))
      delete node.tagName; delete node.properties; delete node.children; delete node.value
      Object.assign(node, replacement); return
    }
    if (!node.children) return
    node.children = node.children.flatMap((child, index) => {
      if (child.type === "text" && node.tagName !== "a") {
        if (node.children?.[index - 1]?.tagName === "img") child.value = child.value?.replace(/^\s*\{:[^}\n]*\}/, "")
        const parts: HtmlNode[] = []; let cursor = 0
        for (const match of (child.value || "").matchAll(new RegExp(markdownImage.source, "g"))) {
          if (match.index! > cursor) parts.push({ type: "text", value: child.value!.slice(cursor, match.index) })
          parts.push(image(match[2].replace(/^<|>$/g, ""), match[1])); cursor = match.index! + match[0].length
        }
        if (!parts.length) return [child]
        if (cursor < child.value!.length) parts.push({ type: "text", value: child.value!.slice(cursor) })
        return parts
      }
      walk(child)
      if (child.tagName === "table") {
        const cells: HtmlNode[] = []
        const collect = (item: HtmlNode) => { if (["td", "th"].includes(item.tagName || "")) cells.push(item); else item.children?.forEach(collect) }
        collect(child)
        if (cells.length === 1 && cells[0].children?.some(item => item.tagName === "img") && cells[0].children.every(mediaOnly)) return cells[0].children
      }
      return [child]
    })
  }
  return walk
}
export function attachmentSize(bytes: number | null): string {
  if (bytes == null) return ""
  const unit = bytes >= 1048576 ? "МБ" : bytes >= 1024 ? "КБ" : "Б"
  const size = bytes / (unit === "МБ" ? 1048576 : unit === "КБ" ? 1024 : 1)
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(size)} ${unit}`
}
export async function readAttachment(url: string, maxBytes: number, signal: AbortSignal, truncate = false): Promise<{ bytes: Uint8Array; truncated: boolean; contentType: string }> {
  const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal })
  if (!response.ok || !response.body) throw new Error("Не удалось загрузить файл. Запросите сведения об инциденте заново")
  const chunks: Uint8Array[] = []; let length = 0, truncated = false
  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      const remaining = maxBytes - length
      if (value.length > remaining) {
        if (!truncate) throw new Error("Файл слишком большой для загрузки в карточке. Откройте оригинал")
        chunks.push(value.subarray(0, remaining)); length += remaining; truncated = true; break
      }
      chunks.push(value); length += value.length
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return { bytes, truncated, contentType: response.headers.get("content-type") || "application/octet-stream" }
}
export function attachmentText(bytes: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1]
  if (charset) { try { return new TextDecoder(charset).decode(bytes) } catch { /* Fall back to detected encoding. */ } }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes)
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch { return new TextDecoder("windows-1251").decode(bytes) }
}
