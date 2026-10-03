const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require('playwright');
let browser,page;
const root=path.resolve(__dirname,'..'),work=path.join(root,'.test-artifacts');
before(async()=>{
  fs.mkdirSync(work,{recursive:true});
  const bundle=await build({entryPoints:[path.join(__dirname,'helpers/browser-entry.js')],bundle:true,write:false,platform:'browser',format:'iife',alias:{obsidian:path.join(__dirname,'helpers/obsidian-mock.js')}});
  browser=await chromium.launch({executablePath:process.env.TET_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  page=await browser.newPage({viewport:{width:1200,height:900}});
  await page.route('https://fixture.invalid/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#d8eaff"/><text x="20" y="50" font-size="20">Trader Chart</text></svg>'}));
  await page.setContent('<html><head></head><body></body></html>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'styles.css'),'utf8')+'body{font:16px sans-serif;padding:40px;background:#fff;color:#202020}.cm-editor{border:1px solid #ddd;width:800px}.cm-content{padding:20px}.markdown-preview-view{width:800px}.modal{position:fixed;inset:60px 180px;background:white;z-index:2000;padding:24px;overflow:auto;border:1px solid #ccc}.setting-item{display:flex;justify-content:space-between;gap:15px;margin:10px 0}'});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
});
after(async()=>{await browser?.close();});
async function setup(text,mode='live') {await page.evaluate(([t,m])=>window.setup(t,m),[text,mode]);await page.waitForTimeout(100);}
async function drag(selector,dx,dy,alt=false) {
  await page.locator(selector).first().click();
  await page.waitForSelector('.tet-resize-overlay');
  const rect=await page.locator('.tet-se').boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
  if(alt) await page.keyboard.down('Alt');
  await page.mouse.move(rect.x+rect.width/2+dx,rect.y+rect.height/2+dy,{steps:5});
  await page.mouse.up();if(alt)await page.keyboard.up('Alt');await page.waitForTimeout(80);
}
test('real CM6 widget drag persists width, undo and rerender',async()=>{
  await setup('![[附件/交易图.png]]');
  await drag('img',80,0);
  assert.equal(await page.evaluate(()=>fixture.text()),'![[附件/交易图.png|280]]');
  assert.equal(await page.locator('img').getAttribute('width'),'280');
  await page.evaluate(()=>fixture.undo());assert.equal(await page.evaluate(()=>fixture.text()),'![[附件/交易图.png]]');
});
test('native image wrapper receives click when child image disables pointer events',async()=>{
  await setup('![[图.png]]');
  await page.locator('img').evaluate(n=>{n.style.pointerEvents='none';n.parentElement.style.display='inline-block';});
  const image=await page.locator('img').boundingBox();await page.mouse.click(image.x+image.width/2,image.y+image.height/2);
  await page.waitForSelector('.tet-resize-overlay');
  const h=await page.locator('.tet-se').boundingBox();await page.mouse.move(h.x+7,h.y+7);await page.mouse.down();await page.mouse.move(h.x+57,h.y+7);await page.mouse.up();await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>fixture.text()),'![[图.png|250]]');
});
test('CM6 table image drag is stable during movement and persists escaped pipe',async()=>{
  await setup('| 场景 | 图 |\n| --- | --- |\n| 普通 | ![[图.png]] |\n| 绘图 | ![[绘图.excalidraw]] |');
  await page.locator('img').click();await page.waitForSelector('.tet-se');
  const tableBefore=await page.locator('table').boundingBox(),handle=await page.locator('.tet-se').boundingBox();
  await page.mouse.move(handle.x+7,handle.y+7);await page.mouse.down();await page.mouse.move(handle.x+107,handle.y+7,{steps:4});
  assert.equal(await page.evaluate(()=>fixture.text().includes('\\|300')),false);
  const tableDuring=await page.locator('table').boundingBox();assert.equal(tableDuring.width,tableBefore.width);
  await page.screenshot({path:path.join(work,'table-drag-live-preview.png')});
  await page.mouse.up();await page.waitForTimeout(80);
  assert.ok((await page.evaluate(()=>fixture.text())).includes('![[图.png\\|300]]'));
  assert.equal(await page.locator('tbody tr').first().locator('td').count(),2);
});
test('Excalidraw table SVG supports free resize and keeps alignment',async()=>{
  await setup('| 名称 | 图 |\n| --- | --- |\n| A | ![[绘图.excalidraw\\|200\\|left]] |');
  await drag('svg.excalidraw-svg',80,25,true);
  assert.ok((await page.evaluate(()=>fixture.text())).includes('![[绘图.excalidraw\\|280x125\\|left]]'));
  assert.equal(await page.locator('tbody td').count(),2);
});
test('native Excalidraw filesource wrapper locates canonical path after async replacement',async()=>{
  await setup('| 名称 | 图 |\n| --- | --- |\n| A | ![[绘图.excalidraw\\|200]] |');
  await page.locator('span.internal-embed').evaluate(n=>{n.className='excalidraw-svg excalidraw-embedded-img';n.setAttribute('filesource','附件/绘图.excalidraw');n.removeAttribute('src');});
  await drag('svg.excalidraw-svg',80,0);
  assert.ok((await page.evaluate(()=>fixture.text())).includes('绘图.excalidraw\\|280'));
});
test('ordinary Markdown image and filename with spaces keep readable destination',async()=>{
  await setup('![图表](<附件/中文 图片 (1).png> "标题")');
  await drag('img',60,0);
  assert.equal(await page.evaluate(()=>fixture.text()),'![图表|260](<附件/中文 图片 (1).png> "标题")');
});
test('duplicate images resize only clicked occurrence in reading table',async()=>{
  await setup('| 项 | 图 |\n| --- | --- |\n| A | ![[图.png]] |\n| B | ![[图.png]] |','reading');
  await page.locator('img').nth(1).click();await page.waitForSelector('.tet-se');
  const h=await page.locator('.tet-se').boundingBox();await page.mouse.move(h.x+7,h.y+7);await page.mouse.down();await page.mouse.move(h.x+87,h.y+7);await page.mouse.up();await page.waitForTimeout(80);
  const text=await page.evaluate(()=>fixture.text());assert.ok(text.includes('| A | ![[图.png]] |'));assert.ok(text.includes('| B | ![[图.png\\|280]] |'));
  assert.equal(await page.evaluate(()=>fixture.backups.length),1);
});
test('Escape cancels drag and unload removes overlay and document listeners',async()=>{
  await setup('![[图.png]]');await page.locator('img').click();await page.waitForSelector('.tet-se');
  const h=await page.locator('.tet-se').boundingBox();await page.mouse.move(h.x+7,h.y+7);await page.mouse.down();await page.mouse.move(h.x+77,h.y+7);await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.evaluate(()=>fixture.text()),'![[图.png]]');assert.equal(await page.locator('.tet-resize-overlay').count(),0);
  await page.evaluate(()=>fixture.plugin.onunload());await page.locator('img').click();assert.equal(await page.locator('.tet-resize-overlay').count(),0);
});
test('concurrent edit during drag aborts source mutation',async()=>{
  await setup('![[图.png]]');await page.locator('img').click();await page.waitForSelector('.tet-se');
  const h=await page.locator('.tet-se').boundingBox();await page.mouse.move(h.x+7,h.y+7);await page.mouse.down();await page.mouse.move(h.x+77,h.y+7);
  await page.evaluate(()=>fixture.cm.dispatch({changes:{from:fixture.cm.state.doc.length,insert:'\n新内容'}}));
  await page.mouse.up();await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>fixture.text()),'![[图.png]]\n新内容');
});
test('format preview performs no writes until confirm; one undo restores original',async()=>{
  const text='# 交易计划\n风险预算\n执行纪律\n- 入场\n- 出场';await setup(text);
  await page.evaluate(()=>fixture.command('format-note'));
  assert.equal(await page.evaluate(()=>fixture.text()),text);assert.equal(await page.evaluate(()=>fixture.backups.length),0);
  await page.getByRole('button',{name:'应用格式化'}).click();await page.waitForTimeout(80);
  assert.ok((await page.evaluate(()=>fixture.text())).includes('风险预算\n\n执行纪律'));
  assert.equal(await page.evaluate(()=>fixture.backups.length),1);
  await page.evaluate(()=>fixture.undo());assert.equal(await page.evaluate(()=>fixture.text()),text);
});
test('color palette retains captured selection after modal focus',async()=>{
  await setup('风险预算');
  await page.evaluate(()=>{fixture.cm.dispatch({selection:{anchor:0,head:4}});fixture.command('style-color');fixture.cm.dispatch({selection:{anchor:0}});});
  await page.getByRole('button',{name:'风险红'}).click();
  assert.equal(await page.evaluate(()=>fixture.text()),'<span style="color: #d64545;">风险预算</span>');
});

test('color followed by highlight and underline retains the visible selected text color',async()=>{
  await setup('风险预算');
  await page.evaluate(()=>{fixture.cm.dispatch({selection:{anchor:0,head:4}});fixture.command('color-slot-1');fixture.command('highlight-slot-2');fixture.command('style-underline');});
  const text=await page.evaluate(()=>fixture.text());await setup(text,'reading');
  assert.equal(await page.locator('u').evaluate(n=>getComputedStyle(n).color),'rgb(214, 69, 69)');
  assert.equal(await page.locator('mark').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 225, 189)');
});
test('settings render without unsupported menu APIs; variables carry into print',async()=>{
  await setup('# 交易计划\n\n第一段自动折行时使用紧凑行距。\n\n第二段。\n\n- 入场\n\n- 出场\n\n| 场景 | 图片 |\n| --- | --- |\n| 风险 | ![[图.png\\|200]] |','reading');
  await page.evaluate(()=>{fixture.plugin.tab.display();document.body.appendChild(fixture.plugin.tab.containerEl);});
  assert.equal(await page.getByRole('slider').count(),10);
  await page.evaluate(()=>fixture.plugin.tab.containerEl.remove());
  const before=await page.locator('p').first().evaluate(el=>({line:getComputedStyle(el).lineHeight,gap:getComputedStyle(el).marginBottom,pad:getComputedStyle(el).paddingTop,bottom:getComputedStyle(el).paddingBottom}));
  await page.emulateMedia({media:'print'});
  const after=await page.locator('p').first().evaluate(el=>({line:getComputedStyle(el).lineHeight,gap:getComputedStyle(el).marginBottom,pad:getComputedStyle(el).paddingTop,bottom:getComputedStyle(el).paddingBottom}));assert.deepEqual(after,before);
  assert.equal(after.gap,'0px');assert.equal(after.pad,'4.48px');assert.equal(after.bottom,'4.48px');assert.equal(after.line,'25.92px');
  await page.screenshot({path:path.join(work,'reading-print-preview.png')});await page.emulateMedia({media:'screen'});
});
test('Excalidraw disabled does not disable normal images or text commands',async()=>{
  await setup('![[图.png]]\n\n![[绘图.excalidraw]]');await page.evaluate(()=>fixture.excalidraw(false));
  await drag('img',40,0);assert.ok((await page.evaluate(()=>fixture.text())).includes('图.png|240'));
  await page.locator('svg').click();await page.waitForTimeout(80);assert.equal(await page.locator('.tet-resize-overlay').count(),0);
});

test('verified WoLai baseline has identical four transitions and no visual blank lines',async()=>{
  const note='正文一\n\n正文二\n\n- 项目一\n\n- 项目二\n\n正文三';
  for(const mode of ['live','reading']) {
    await setup(note,mode);
    const values=await page.locator(mode==='live'?'.tet-block-start':'.markdown-preview-view > p,.markdown-preview-view li').evaluateAll(nodes=>nodes.map(n=>{
      const c=getComputedStyle(n),r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,padTop:parseFloat(c.paddingTop),padBottom:parseFloat(c.paddingBottom),line:c.lineHeight,margin:c.marginBlock};
    }));
    assert.equal(values.length,5);
    for(const v of values) {assert.equal(v.padTop,4.48);assert.equal(v.padBottom,4.48);assert.equal(v.line,'25.92px');assert.equal(v.margin,'0px');}
    const gaps=values.slice(1).map((v,i)=>v.top+v.padTop-values[i].bottom+values[i].padBottom);
    for(const gap of gaps) assert.ok(Math.abs(gap-8.96)<0.1,`${mode}: ${gap}`);
    if(mode==='live') assert.deepEqual(await page.locator('.tet-gap').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)),[0,0,0,0]);
  }
});

test('automatic wrapped lines get only one pair of block padding',async()=>{
  await setup('自动折行测试内容。'.repeat(90));
  const value=await page.locator('.tet-prose').evaluate(n=>({height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight),padding:parseFloat(getComputedStyle(n).paddingTop)+parseFloat(getComputedStyle(n).paddingBottom)}));
  assert.ok(value.height>value.line*3);assert.equal(value.padding,8.96);
  assert.ok(Math.abs((value.height-value.padding)/value.line-Math.round((value.height-value.padding)/value.line))<0.03);
});

test('headings keep symmetric specified em padding',async()=>{
  await setup('# 一\n\n## 二\n\n### 三\n\n#### 四\n\n##### 五\n\n###### 六','reading');
  const values=await page.locator('h1,h2,h3,h4,h5,h6').evaluateAll(ns=>ns.map(n=>{const c=getComputedStyle(n);return [parseFloat(c.paddingTop)/parseFloat(c.fontSize),parseFloat(c.paddingBottom)/parseFloat(c.fontSize),c.marginBlock];}));
  for(let i=0;i<6;i++) {assert.ok(Math.abs(values[i][0]-[.95,.82,.70,.58,.58,.58][i])<.001);assert.equal(values[i][0],values[i][1]);assert.equal(values[i][2],'0px');}
});

test('quote adjacent to heading and list does not swallow Live Preview layout',async()=>{
  const input='## 第一节\n> 第一段引用\n## 第二节\n> 第二段引用\n- 项目一\n- 项目二\n惰性续行';
  await setup(input);
  assert.equal(await page.locator('.tet-h2').count(),2);
  assert.equal(await page.locator('.tet-list-line').count(),2);
  assert.equal(await page.locator('.tet-list-continuation').count(),1);
  assert.equal(await page.locator('.tet-list-line').nth(1).evaluate(n=>getComputedStyle(n).paddingBottom),'0px');
  assert.equal(await page.locator('.tet-list-continuation').evaluate(n=>getComputedStyle(n).lineHeight),'25.92px');
  assert.equal(await page.locator('.tet-list-continuation').evaluate(n=>getComputedStyle(n).paddingBottom),'4.48px');
  assert.equal(await page.evaluate(()=>fixture.text()),input);
  assert.equal(await page.evaluate(()=>fixture.backups.length),0);
});

test('formatting repaired quote boundaries agrees with standard reading Markdown structure',async()=>{
  const text=await page.evaluate(()=>formatNote('## 第一节\n> 引用\n## 第二节\n> 另一引用\n- 项目一\n- 项目二\n后续正文').text);
  await setup(text,'reading');
  assert.equal(await page.locator('h2').count(),2);assert.equal(await page.locator('blockquote').count(),2);assert.equal(await page.locator('li').count(),2);
  assert.equal(await page.locator('blockquote h2,blockquote ul').count(),0);
  assert.equal(await page.locator('.markdown-preview-view > p').last().textContent(),'后续正文');
});
