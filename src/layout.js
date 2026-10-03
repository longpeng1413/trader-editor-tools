const { ViewPlugin, Decoration, keymap } = require('@codemirror/view');
const { RangeSetBuilder, Prec, EditorState } = require('@codemirror/state');
const { editorInfoField } = require('obsidian');
const { classify } = require('./markdown');

function layoutExtension(plugin) {
  const decorations = ViewPlugin.fromClass(class {
    constructor(view) { this.view = view; plugin.cmViews.add(view); plugin.bindDocument(view.dom.ownerDocument); this.decorations = this.build(); }
    update(update) {
      if (update.docChanged || update.viewportChanged || update.transactions.length) this.decorations = this.build();
    }
    destroy() { plugin.cmViews.delete(this.view); }
    build() {
      const builder = new RangeSetBuilder();
      if (!plugin.settings.layoutEnabled) return builder.finish();
      const view = this.view;
      // Do not style source mode, fenced text, quotes, metadata, or HTML.
      const info = view.state.field(editorInfoField,false);
      if (info?.getMode?.() === 'source' && info?.getState?.()?.source === true) return builder.finish();
      const doc = view.state.doc;
      const { kinds, lines, continuations, quotes, quoteBlanks, indentedCode } = classify(doc.toString());
      let previous=-1;
      for (const range of view.visibleRanges) {
        const first = doc.lineAt(range.from).number, last = doc.lineAt(range.to).number;
        for (let n = first; n <= last; n++) {
          const line = doc.line(n), kind = kinds[n-1];
          if(line.from<=previous) continue;
          previous=line.from;
          if (kind === 'table' || (kind === 'protected' && !continuations[n-1] && !quotes[n-1] && !indentedCode[n-1])) continue;
          const cls = kind === 'blank' ? 'tet-gap' : kind === 'heading' ? 'tet-heading' : kind === 'list' ? 'tet-list-line' : kind === 'image' ? 'tet-image-line' : 'tet-prose';
          const attrs = { class: cls };
          if(kind==='prose') {
            if(kinds[n-2]!=='prose') attrs.class+=' tet-block-start';
            if(kinds[n]!=='prose') attrs.class+=' tet-block-end';
          }
          if(kind==='list') {
            attrs.class+=' tet-block-start';
            if(!continuations[n]) attrs.class+=' tet-block-end';
          }
          if(continuations[n-1]) {
            attrs.class+=' tet-list-continuation';
            if(kinds[n-2]==='blank') attrs.class+=' tet-block-start';
            if(!continuations[n]) attrs.class+=' tet-block-end';
          }
          if(quotes[n-1]) {
            attrs.class=quoteBlanks[n-1] ? 'tet-quote-line tet-quote-gap' : 'tet-quote-line';
            if(!quoteBlanks[n-1]) {
              if(!quotes[n-2] || quoteBlanks[n-2]) attrs.class+=' tet-block-start';
              if(!quotes[n] || quoteBlanks[n]) attrs.class+=' tet-block-end';
            }
          }
          if(indentedCode[n-1]) {
            attrs.class='tet-code-line';
            if(!indentedCode[n-2]) attrs.class+=' tet-block-start';
            if(!indentedCode[n]) attrs.class+=' tet-block-end';
          }
          if(kind==='heading') attrs.class+=` tet-h${Math.min(6,(lines[n-1].text.match(/^\s*(#+)/)?.[1] || '#').length)}`;
          builder.add(line.from,line.from,Decoration.line({attributes:attrs}));
        }
      }
      return builder.finish();
    }
  }, { decorations: value => value.decorations });
  return [decorations, Prec.highest(keymap.of([{key:'Enter',run:view=>{
    if(!plugin.settings.paragraphEnter || !plugin.settings.splitProseLines || view.state.selection.ranges.length!==1 || view.state.facet(EditorState.readOnly)) return false;
    const info=view.state.field(editorInfoField,false);
    if(!info?.file || info?.getState?.()?.source===true || info.file.path.match(/\.excalidraw(?:\.md)?$/i)) return false;
    const selection=view.state.selection.main,line=view.state.doc.lineAt(selection.head);
    if(!selection.empty || selection.head!==line.to || !line.text.trim() || /(?: {2,}|\\)$/.test(line.text)) return false;
    const data=classify(view.state.doc.toString());
    if(data.kinds[line.number-1]!=='prose') return false;
    // User keystroke only: never rewrites opened notes. Native list/quote/code
    // Enter handlers retain control. Existing blank separators are reused.
    const tail=view.state.doc.sliceString(line.to);
    if(!tail.trim()) {
      const breaks=(tail.match(/\n/g)||[]).length;
      const insert='\n'.repeat(Math.max(0,2-breaks));
      view.dispatch({changes:insert?{from:line.to,insert}:undefined,selection:{anchor:line.to+2},scrollIntoView:true,userEvent:'input'});
    } else {
      const next=view.state.doc.line(line.number+1).text;
      // Leave a separator on BOTH sides of a newly typed paragraph when
      // subsequent content already exists. Caret must land after two breaks.
      const insert=next.trim()?'\n\n\n':'\n\n';
      view.dispatch({changes:{from:line.to,insert},selection:{anchor:line.to+2},scrollIntoView:true,userEvent:'input'});
    }
    return true;
  }}]))];
}

function applyLayout(doc, settings) {
  doc.body.classList.toggle('tet-enabled',settings.layoutEnabled);
  const vars = {
    '--tet-line-height': settings.lineHeight,
    '--tet-block-padding': settings.blockPadding + 'em',
    '--tet-h1': settings.headingH1 + 'em',
    '--tet-h2': settings.headingH2 + 'em',
    '--tet-h3': settings.headingH3 + 'em',
    '--tet-h4': settings.headingH4 + 'em',
    '--tet-list-indent': settings.listIndent + 'em',
    '--tet-image-padding': settings.imagePadding + 'em',
    '--tet-table-padding': settings.tablePadding + 'em',
  };
  let style = doc.getElementById('tet-layout-vars');
  if (!style) { style = doc.createElement('style'); style.id = 'tet-layout-vars'; doc.head.appendChild(style); }
  // Also reaches Obsidian's temporary print tree; settings travel in a style
  // sheet, not transient inline CSS on a particular renderer element.
  style.textContent = `:root { ${Object.entries(vars).map(([k,v])=>`${k}: ${v};`).join(' ')} }`;
}

module.exports = { layoutExtension, applyLayout };
