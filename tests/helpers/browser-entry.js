const {EditorState}=require('@codemirror/state');
const {EditorView,Decoration,WidgetType}=require('@codemirror/view');
const {StateField}=require('@codemirror/state');
const {history,undo,redo,isolateHistory}=require('@codemirror/commands');
const {marked}=require('marked');
const {editorInfoField,MarkdownView,notices}=require('./obsidian-mock');
const Trader=require('../../src/main');
const {scanImages,isExcalidraw,formatNote}=require('../../src/markdown');

for(const proto of [HTMLElement.prototype,DocumentFragment.prototype]) {
  proto.createEl=function(tag,options={}){const el=document.createElement(tag);if(options.text)el.textContent=options.text;if(options.cls)el.className=options.cls;this.appendChild(el);return el;};
  proto.createDiv=function(options={}){return this.createEl('div',options);};proto.createSpan=function(options={}){return this.createEl('span',options);};
  proto.empty=function(){this.replaceChildren();};
}

const esc=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function rendered(text) {
  let output=text;
  const tokens=scanImages(text);
  for(const t of [...tokens].reverse()) {
    const dimension=(t.type==='wiki'?t.parts.slice(1).find(p=>/^\d+(?:x\d+)?$/.test(p)):t.alt.match(/(?:\\?\|)?(\d+(?:x\d+)?)$/)?.[1]) || '200';
    const [w,h]=dimension.split('x').map(Number);
    const html=isExcalidraw(t) ? `<span class="internal-embed excalidraw-embedded-img" src="${esc(t.target)}"><svg class="excalidraw-svg" width="${w}" height="${h||w/2}" viewBox="0 0 200 100"><rect width="200" height="100" fill="#e7effb"/><path d="M10 85 L45 70 L85 75 L120 30 L190 15" stroke="#367bd6" stroke-width="5" fill="none"/></svg></span>` : `<span class="internal-embed image-embed" src="${esc(t.target)}"><img src="https://fixture.invalid/${encodeURI(t.target)}" width="${w}" ${h ? 'height="'+h+'"' : ''} alt="${esc(t.alt)}"></span>`;
    output=output.slice(0,t.start)+html+output.slice(t.end);
  }
  return marked.parse(output);
}
class PreviewWidget extends WidgetType {
  constructor(text){super();this.text=text;}
  eq(other){return this.text===other.text;}
  toDOM(){const div=document.createElement('div');div.className='cm-embed-block markdown-rendered';div.innerHTML=rendered(this.text);return div;}
}
const widgetField=StateField.define({
  create:state=>widgets(state),update:(_,tr)=>widgets(tr.state),
  provide:field=>EditorView.decorations.from(field),
});
function widgets(state) {
  const text=state.doc.toString(),lines=text.split('\n');const marks=[];
  let offset=0;
  for(let i=0;i<lines.length;i++) {
    if(lines[i].startsWith('|') && i+1<lines.length && /---/.test(lines[i+1])) {
      let end=i;while(end+1<lines.length && lines[end+1].startsWith('|'))end++;
      const block=lines.slice(i,end+1).join('\n');
      marks.push(Decoration.replace({widget:new PreviewWidget(block),block:true}).range(offset,offset+block.length));
      offset+=block.length+1;i=end;continue;
    }
    if(/^!\[/.test(lines[i])) marks.push(Decoration.replace({widget:new PreviewWidget(lines[i]),block:true}).range(offset,offset+lines[i].length));
    offset+=lines[i].length+1;
  }
  return Decoration.set(marks);
}

async function setup(text,mode='live') {
  if(window.fixture) {window.fixture.plugin.onunload();window.fixture.cm?.destroy();}
  document.body.replaceChildren();
  const file={path:'笔记/验收.md',basename:'验收',extension:'md'};
  const store=new Map([[file.path,text]]),backups=[];
  const callbacks=new Map();let excalidraw=true;
  const app={workspace:{containerEl:document.body,on:(name,fn)=>{callbacks.set(name,fn);return {};},iterateAllLeaves:fn=>fn({view:info})},vault:{configDir:'.obsidian',getAbstractFileByPath:p=>p===file.path?file:{path:p,basename:p.split('/').at(-1),extension:p.split('.').at(-1)},read:async f=>store.get(f.path),process:async(f,fn)=>{store.set(f.path,fn(store.get(f.path)));return store.get(f.path);},adapter:{exists:async()=>true,mkdir:async()=>{},write:async(p,t)=>backups.push({p,t})}},metadataCache:{getFirstLinkpathDest:(p,base)=>/^https?:/.test(p)?null:{path:p.includes('/')?p:'附件/'+p,extension:p.split('.').at(-1)},getFileCache:f=>({frontmatter:f.path.includes('绘图')?{'excalidraw-plugin':'parsed'}:{}})},plugins:{getPlugin:()=>excalidraw?{}:null}};
  const root=document.createElement('div');root.className=mode==='live'?'markdown-source-view mod-cm6 is-live-preview':'markdown-preview-view markdown-rendered';document.body.appendChild(root);
  const plugin=new Trader(app,{id:'trader-editor-tools'});let cm;
  const info=new MarkdownView();info.file=file;info.containerEl=root;info.getMode=()=>mode==='live'?'source':'preview';info.getState=()=>({source:false});
  await plugin.onload();
  if(mode==='live') {
    const editor={getValue:()=>cm.state.doc.toString(),getCursor:(which='head')=>editor.offsetToPos(which==='from'?cm.state.selection.main.from:which==='to'?cm.state.selection.main.to:cm.state.selection.main.head),posToOffset:p=>cm.state.doc.line(p.line+1).from+p.ch,offsetToPos:p=>{const l=cm.state.doc.lineAt(Math.min(p,cm.state.doc.length));return {line:l.number-1,ch:p-l.from};},getSelection:()=>cm.state.sliceDoc(cm.state.selection.main.from,cm.state.selection.main.to),setSelection:(from,to)=>cm.dispatch({selection:{anchor:editor.posToOffset(from),head:editor.posToOffset(to)}}),focus:()=>cm.focus(),lastLine:()=>cm.state.doc.lines-1,getLine:n=>cm.state.doc.line(n+1).text,transaction:tx=>{const changes=tx.changes.map(c=>({from:editor.posToOffset(c.from),to:editor.posToOffset(c.to),insert:c.text}));const next=cm.state.doc.toString();let nextText=next;for(const c of [...changes].reverse()) nextText=nextText.slice(0,c.from)+c.insert+nextText.slice(c.to);const pos=p=>{const ls=nextText.split('\n');return ls.slice(0,p.line).reduce((s,l)=>s+l.length+1,0)+p.ch;};cm.dispatch({changes,selection:tx.selection?{anchor:pos(tx.selection.from),head:pos(tx.selection.to)}:undefined,annotations:isolateHistory.of('full')});}};
    info.editor=editor;
    cm=new EditorView({parent:root,state:EditorState.create({doc:text,extensions:[editorInfoField.init(()=>info),history(),widgetField,...plugin.ext,EditorView.lineWrapping]})});
  } else {
    root.innerHTML=rendered(text);
    for(const fn of plugin.post) fn(root,{sourcePath:file.path,getSectionInfo:()=>({text:store.get(file.path),lineStart:0,lineEnd:store.get(file.path).split('\n').length-1})});
  }
  window.fixture={plugin,app,file,info,root,cm,store,backups,notices,callbacks,text:()=>mode==='live'?cm.state.doc.toString():store.get(file.path),command:id=>plugin.commands.get(id).editorCallback(info.editor,info),undo:()=>undo(cm),redo:()=>redo(cm),excalidraw:value=>excalidraw=value};
  return true;
}
window.setup=setup;window.rendered=rendered;window.formatNote=formatNote;
