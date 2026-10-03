const HEX = /^#[0-9a-f]{6}$/i;
const tag = {
  color: { open: color => `<span style="color: ${color};">`, close: '</span>', pattern: /^<span style="color:\s*(#[0-9a-f]{6});?">([\s\S]*)<\/span>$/i },
  highlight: { open: (color,foreground='#202020') => `<mark style="background-color: ${color}; color: ${foreground};">`, close: '</mark>', pattern: /^<mark style="background-color:\s*(#[0-9a-f]{6});(?: color:\s*#[0-9a-f]{6};)?">([\s\S]*)<\/mark>$/i },
  underline: { open: () => '<u>', close: '</u>', pattern: /^<u>([\s\S]*)<\/u>$/i },
};

/** Operate only on full outer wrappers: never remove arbitrary HTML. */
function stylePatch(text, start, end, kind, value) {
  if (start === end) throw new Error('请先选中文字');
  if (!tag[kind] && kind !== 'clear') throw new Error('未知样式');
  if (['color','highlight'].includes(kind) && !HEX.test(value)) throw new Error('颜色必须是 #RRGGBB');
  const selected = text.slice(start,end);
  if (/[\r\n]/.test(selected)) throw new Error('文字样式请在一个段落内选取；不跨段落或表格行应用 HTML');
  let left = start, right = end, inner = selected;
  const unwrap = k => {
    const t = tag[k];
    const whole = inner.match(t.pattern);
    const wholeInner=whole?.[k === 'underline' ? 1 : 2];
    if (whole && !wholeInner.includes(t.close)) { inner = wholeInner; return true; }
    // Full wrapper directly around selection; content cannot contain nested
    // same-name closing tags, otherwise the ownership is ambiguous.
    const before = text.slice(0,left), after = text.slice(right);
    const regex = k === 'color' ? /<span style="color:\s*#[0-9a-f]{6};?">$/i : k === 'highlight' ? /<mark style="background-color:\s*#[0-9a-f]{6};(?: color:\s*#[0-9a-f]{6};)?">$/i : /<u>$/i;
    const m = before.match(regex);
    if (m && after.startsWith(t.close) && !inner.includes(t.close)) {
      left -= m[0].length; right += t.close.length; return true;
    }
    return false;
  };
  if (kind === 'clear') {
    let changed;
    do { changed = false; for (const k of Object.keys(tag)) changed = unwrap(k) || changed; } while (changed);
    return { from: left, to: right, text: inner, selectFrom: left, selectTo: left + inner.length };
  }
  const existing = unwrap(kind);
  if (kind === 'underline' && existing) return { from: left, to: right, text: inner, selectFrom:left, selectTo:left+inner.length };
  // A new highlight must not silently override an explicit text color on the
  // owned surrounding selection; otherwise color -> highlight loses the color.
  const ancestorColor=text.slice(0,left).match(/<span style="color:\s*(#[0-9a-f]{6});?">(?:<u>|<mark style="background-color:\s*#[0-9a-f]{6};(?: color:\s*#[0-9a-f]{6};)?">)*$/i)?.[1];
  const open = tag[kind].open(value,ancestorColor), close = tag[kind].close;
  return { from:left, to:right, text:open + inner + close, selectFrom:left+open.length, selectTo:left+open.length+inner.length };
}

function captureSelection(editor, file) {
  const text = editor.getValue();
  const start = editor.posToOffset(editor.getCursor('from'));
  const end = editor.posToOffset(editor.getCursor('to'));
  if (start === end) throw new Error('请先选中文字');
  return { editor, file, text, start, end };
}

function commitStyle(snapshot, kind, value) {
  const { editor, text, start, end } = snapshot;
  if (editor.getValue() !== text || (snapshot.info && snapshot.info.file?.path !== snapshot.file?.path)) throw new Error('笔记已变化，请重新选择文字');
  const p = stylePatch(text,start,end,kind,value);
  const next = text.slice(0,p.from) + p.text + text.slice(p.to);
  const pos = offset => {
    const parts = next.slice(0,offset).split('\n');
    return { line:parts.length-1, ch:parts.at(-1).length };
  };
  editor.transaction({ changes:[{from:editor.offsetToPos(p.from),to:editor.offsetToPos(p.to),text:p.text}], selection:{from:pos(p.selectFrom),to:pos(p.selectTo)} });
  editor.focus();
}
module.exports = { stylePatch, captureSelection, commitStyle, HEX };
