const { ViewPlugin, Decoration } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');
const { editorInfoField } = require('obsidian');
const { classify } = require('./markdown');

function layoutExtension(plugin) {
  return ViewPlugin.fromClass(class {
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
      const { kinds, lines, continuations } = classify(doc.toString());
      let previous=-1;
      for (const range of view.visibleRanges) {
        const first = doc.lineAt(range.from).number, last = doc.lineAt(range.to).number;
        for (let n = first; n <= last; n++) {
          const line = doc.line(n), kind = kinds[n-1];
          if(line.from<=previous) continue;
          previous=line.from;
          if (kind === 'table' || (kind === 'protected' && !continuations[n-1])) continue;
          const cls = kind === 'blank' ? 'tet-gap' : kind === 'heading' ? 'tet-heading' : kind === 'list' ? 'tet-list-line' : kind === 'image' ? 'tet-image-line' : 'tet-prose';
          const attrs = { class: cls };
          if(kind==='prose') {
            if(kinds[n-2]!=='prose') attrs.class+=' tet-block-start';
            if(kinds[n]!=='prose') attrs.class+=' tet-block-end';
          }
          if(kind==='list' && /^\S/.test(lines[n-1].text)) {
            attrs.class+=' tet-block-start';
            if(!continuations[n]) attrs.class+=' tet-block-end';
          }
          if(continuations[n-1]) {
            attrs.class+=' tet-list-continuation';
            if(!continuations[n]) attrs.class+=' tet-block-end';
          }
          if(kind==='heading') attrs.class+=` tet-h${Math.min(6,(lines[n-1].text.match(/^\s*(#+)/)?.[1] || '#').length)}`;
          builder.add(line.from,line.from,Decoration.line({attributes:attrs}));
        }
      }
      return builder.finish();
    }
  }, { decorations: value => value.decorations });
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
