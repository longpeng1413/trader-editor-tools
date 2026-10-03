// Explicitly scoped native diagnostics; never defaults to an active vault.
const {execFileSync}=require('node:child_process');
const vault=process.argv[2];
if(!vault) throw new Error('Usage: node scripts/native-diagnostics.cjs <test-vault-name>');
const cli=process.env.OBSIDIAN_CLI || 'Obsidian.com';
const code=`(async()=>{
  const p=app.plugins.getPlugin('trader-editor-tools');
  const view=app.workspace.activeLeaf?.view;
  if(!view?.file?.path.startsWith('Trader Editor Tools 验收/')) throw new Error('Active file is outside the test folder');
  const mode=view.getMode();
  const roots=[...p.cmViews].map(v=>v.dom).filter(d=>view.containerEl.contains(d));
  const root=mode==='source' ? roots[0] : view.previewMode.containerEl;
  const nodes=[...root.querySelectorAll('img,svg.excalidraw-svg')].filter(n=>n.getBoundingClientRect().width>0);
  const results=[];
  for(const n of nodes) {
    const embed=n.closest('.excalidraw-embedded-img[filesource]')||n.closest('.internal-embed')||n;
    const c=p.images.contextFor(n),section=c?.ctx.getSectionInfo(c.root);
    let source;try{const s=await p.images.locate({element:n,embed});source={raw:s.token.raw,start:s.token.start,inTable:s.token.inTable,editor:!!s.editor};}catch(e){source={error:e.message};}
    results.push({src:embed.getAttribute('src')||embed.getAttribute('filesource'),alt:n.getAttribute('alt'),class:n.getAttribute('class'),table:!!n.closest('table'),section:section&&[section.lineStart,section.lineEnd],source});
  }
  return JSON.stringify({mode,views:p.cmViews.size,rootClass:root?.className,results});
})()`;
console.log(execFileSync(cli,['vault='+vault,'eval','code='+code],{encoding:'utf8',timeout:15000}));
