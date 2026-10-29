import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { normalizeAttachments, canPreviewAttachment, inlineAttachments, rehypeItsmAttachments, attachmentText, readAttachment } from '../lib/itsm-attachments.ts';

const key='attachments/567/2026/10/27/image/screen.png';
const uri=`https://assets.itsm.mos.ru/storage/${key}?expiration=1793385034&signature=fixture`;
const files=normalizeAttachments([{id:42,name:'screen.png',key,uri,size:26619}]);
const render=text=>renderToStaticMarkup(React.createElement(Markdown,{remarkPlugins:[remarkGfm],rehypePlugins:[rehypeRaw,[rehypeItsmAttachments,{attachments:files}],rehypeSanitize]},text));

test('4me Markdown inside a one-cell HTML table resolves to the signed image and loses technical markup',()=>{
  const source=`Текст до\n\n<table><tr><th>\n![](${key}){:filesize="26619" size="814x539"}\n\n</th></tr></table>\n\nТекст после`;
  const html=render(source);
  assert.match(html,/<img /); assert.ok(html.includes('signature=fixture'));
  assert.ok(!html.includes('<table')); assert.ok(!html.includes('filesize')); assert.ok(!html.includes('![]'));
  assert.ok(html.includes('Текст до')); assert.ok(html.includes('Текст после'));
  assert.deepEqual([...inlineAttachments(source,files)],['42']);
});
test('normal Markdown, raw HTML images and filenames resolve consistently without touching real data tables or code',()=>{
  assert.ok(render(`![](${key}){:filesize="26619"}`).includes('signature=fixture'));
  assert.ok(!render(`![](${key}){:filesize="26619"}`).includes('filesize'));
  assert.ok(render(`<img src="${key}" onerror="alert(1)">`).includes('signature=fixture'));
  assert.ok(!render(`<img src="${key}" onerror="alert(1)">`).includes('onerror'));
  assert.ok(render('<table><tr><td>A</td><td>B</td></tr></table>').includes('<table>'));
  assert.ok(render('```\n![]('+key+')\n```').includes('![]'));
});
test('previews cannot load arbitrary tracking images, embedded credentials, SVG or script URLs',()=>{
  for(const src of ['https://untrusted.example/tracking.png','javascript:alert(1)','data:image/svg+xml,test']) assert.ok(!render(`<img src="${src}">`).includes('<img '));
  assert.equal(canPreviewAttachment('https://assets.itsm.mos.ru.evil.example/storage/attachments/a.png'),false);
  assert.equal(canPreviewAttachment('https://user:password@assets.itsm.mos.ru/storage/attachments/a.png'),false);
  assert.equal(canPreviewAttachment(uri),true);
  assert.equal(canPreviewAttachment('http://localhost:3015/test.png','http://localhost:3015'),true);
  assert.ok(!render('<img src="https://assets.itsm.mos.ru/storage/attachments/diagram.svg">').includes('<img '));
  const normalized=normalizeAttachments([{id:1,name:'diagram.svg',uri},{id:2,name:'report.XML',uri},{id:3,name:'log.TXT',uri},{id:4,name:'report.xlsx',uri}]);
  assert.deepEqual(normalized.map(file=>file.kind),['file','file','text','file']);
});
test('text previews decode Russian UTF-8, Windows-1251 and UTF-16 while remaining plain text',()=>{
  assert.equal(attachmentText(new globalThis.TextEncoder().encode('Текст <script>plain</script>'),'text/plain'),'Текст <script>plain</script>');
  assert.equal(attachmentText(new Uint8Array([0xd2,0xe5,0xf1,0xf2]),'text/plain'),'Тест');
  assert.equal(attachmentText(new Uint8Array([0xff,0xfe,0x22,0x04]),'text/plain'),'Т');
});
test('attachment reads omit credentials and referrer, limit bytes and preserve the original download data',async()=>{
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,uri); assert.equal(options.credentials,'omit'); assert.equal(options.referrerPolicy,'no-referrer'); assert.equal(options.redirect,'error');
      return new globalThis.Response(new Uint8Array([0,1,2,3,4,5]),{headers:{'Content-Type':'application/octet-stream'}});
    };
    const full=await readAttachment(uri,100,globalThis.AbortSignal.timeout(1000)); assert.deepEqual([...full.bytes],[0,1,2,3,4,5]); assert.equal(full.truncated,false);
    const preview=await readAttachment(uri,3,globalThis.AbortSignal.timeout(1000),true); assert.deepEqual([...preview.bytes],[0,1,2]); assert.equal(preview.truncated,true);
    await assert.rejects(readAttachment(uri,3,globalThis.AbortSignal.timeout(1000)),/слишком большой/);
  }finally{globalThis.fetch=originalFetch;}
});
