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

test('image size command prefills existing Markdown width and height, saves and undoes safely',async()=>{
  const source='![图|280x150](<附件/中文 图片.png> "标题")';await setup(source);
  await page.evaluate(()=>{fixture.cm.dispatch({selection:{anchor:5}});fixture.command('set-image-size');});
  const inputs=page.locator('.modal input[type=text]');
  assert.equal(await inputs.nth(0).inputValue(),'280');assert.equal(await inputs.nth(1).inputValue(),'150');
  await inputs.nth(0).fill('300');await page.getByRole('button',{name:'保存到笔记'}).click();
  assert.equal(await page.evaluate(()=>fixture.text()),'![图|300x150](<附件/中文 图片.png> "标题")');
  await page.evaluate(()=>fixture.undo());assert.equal(await page.evaluate(()=>fixture.text()),source);
});

test('stale format preview and text palette never overwrite a concurrent edit',async()=>{
  await setup('第一行\n第二行');await page.evaluate(()=>fixture.command('format-note'));
  await page.evaluate(()=>fixture.cm.dispatch({changes:{from:fixture.cm.state.doc.length,insert:'新'}}));
  await page.getByRole('button',{name:'应用格式化'}).click();
  assert.equal(await page.evaluate(()=>fixture.text()),'第一行\n第二行新');assert.equal(await page.evaluate(()=>fixture.backups.length),0);
  await setup('风险预算');await page.evaluate(()=>{fixture.cm.dispatch({selection:{anchor:0,head:4}});fixture.command('style-color');});
  await page.evaluate(()=>fixture.cm.dispatch({changes:{from:fixture.cm.state.doc.length,insert:'新'}}));
  await page.getByRole('button',{name:'风险红'}).click();assert.equal(await page.evaluate(()=>fixture.text()),'风险预算新');
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
test('quote, prose, list and standalone indented code have equal external block gaps',async()=>{
  const input='第一段\n\n第二段\n\n- A\n\n- B\n\n> 引用\n> 引用内软换行\n\n第三段\n\n    缩进代码\n    代码内换行\n\n第四段';
  for(const mode of ['live','reading']) {
    await setup(input,mode);
    const selector=mode==='live'?'.tet-block-start':'.markdown-preview-view > p,.markdown-preview-view > blockquote,.markdown-preview-view > pre,.markdown-preview-view > ul > li';
    const boxes=await page.locator(selector).evaluateAll(ns=>ns.map(n=>{let r=n.getBoundingClientRect(),c=getComputedStyle(n);return {top:r.top,bottom:r.bottom,padTop:parseFloat(c.paddingTop),padBottom:parseFloat(c.paddingBottom),margin:c.marginBlock};}));
    assert.equal(boxes.length,8);
    // Multi-line quote/code LP blocks consist of multiple CM lines.
    if(mode==='live') {
      const endings=await page.locator('.tet-block-end').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().bottom));
      for(let i=1;i<boxes.length;i++) assert.ok(Math.abs(boxes[i].top+boxes[i].padTop-endings[i-1]+4.48-8.96)<0.1,JSON.stringify(boxes));
    } else {
      for(let i=1;i<boxes.length;i++) assert.ok(Math.abs(boxes[i].top+boxes[i].padTop-boxes[i-1].bottom+boxes[i-1].padBottom-8.96)<0.1,JSON.stringify(boxes));
    }
    for(const b of boxes) {assert.equal(b.padTop,4.48);assert.equal(b.margin,'0px');}
    if(mode==='reading') {
      const before=await page.locator(selector).evaluateAll(ns=>ns.map(n=>{const c=getComputedStyle(n);return [c.paddingTop,c.paddingBottom,c.marginBlock,c.lineHeight];}));
      await page.emulateMedia({media:'print'});
      const after=await page.locator(selector).evaluateAll(ns=>ns.map(n=>{const c=getComputedStyle(n);return [c.paddingTop,c.paddingBottom,c.marginBlock,c.lineHeight];}));
      assert.deepEqual(after,before);await page.emulateMedia({media:'screen'});
    }
    assert.equal(await page.evaluate(()=>fixture.text()),input);
  }
});
test('list indented paragraphs use same block gaps without altering nesting',async()=>{
  const input='- A\n\n  child one\n\n  child two\n\n- B\n\n正文';
  await setup(input);
  const starts=await page.locator('.tet-block-start').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().top+parseFloat(getComputedStyle(n).paddingTop)));
  const ends=await page.locator('.tet-block-end').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().bottom-parseFloat(getComputedStyle(n).paddingBottom)));
  assert.equal(starts.length,5);assert.equal(ends.length,5);
  for(let i=1;i<starts.length;i++)assert.ok(Math.abs(starts[i]-ends[i-1]-8.96)<.1);
  await setup(input,'reading');
  assert.equal(await page.locator('li').count(),2);
  assert.equal(await page.locator('li').first().locator('p').count(),3);
  const paragraphs=await page.locator('li').first().locator('p').evaluateAll(ns=>ns.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom,pad:parseFloat(getComputedStyle(n).paddingTop)})));
  for(let i=1;i<paragraphs.length;i++)assert.ok(Math.abs(paragraphs[i].top+paragraphs[i].pad-paragraphs[i-1].bottom-8.96)<.1);
});
test('Enter is not intercepted, including legacy paragraphEnter settings; native host owns editing',async()=>{
  // Fixture has CM's plain fallback, not Obsidian's Markdown continuation
  // keymap. Assert that the plugin does not add any Enter behavior of its own.
  for(const text of ['正文','- list','> quote','>**quote**','\tcode','```js','line  ']) {
    await setup(text);await page.evaluate(()=>{fixture.plugin.settings.paragraphEnter=true;fixture.cm.dispatch({selection:{anchor:fixture.text().length}});});
    await page.locator('.cm-content').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>fixture.text()),text+'\n');
    const height=await page.locator('.cm-line').last().evaluate(n=>n.getBoundingClientRect().height);assert.ok(height>0,text);
    await page.evaluate(()=>fixture.undo());assert.equal(await page.evaluate(()=>fixture.text()),text);
  }
  await setup('正文');await page.evaluate(()=>fixture.cm.dispatch({selection:{anchor:1}}));await page.locator('.cm-content').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>fixture.text()),'正\n文');
});
test('caret blank, Tab-only and quote-prefix rows stay visible and editable without altering separators',async()=>{
  for(const prefix of ['','\t','\t\t','> ','> > ']) {
    const text='前文\n\n'+prefix+'\n\n后文';await setup(text);
    await page.evaluate(p=>fixture.cm.dispatch({selection:{anchor:fixture.cm.state.doc.line(3).from+p.length}}),prefix);await page.locator('.cm-content').focus();
    await page.waitForSelector('.tet-input-gap');
    const active=page.locator('.tet-input-gap');assert.equal(await active.count(),1);
    assert.ok(await active.evaluate(n=>n.getBoundingClientRect().height)>=25.9);
    assert.equal(await active.evaluate(n=>getComputedStyle(n).lineHeight),'25.92px');
    assert.equal(await page.evaluate(()=>fixture.text()),text);
    await page.keyboard.type('new');assert.equal(await page.evaluate(()=>fixture.text()),'前文\n\n'+prefix+'new\n\n后文');
    await page.evaluate(()=>fixture.undo());assert.equal(await page.evaluate(()=>fixture.text()),text);
    await page.evaluate(()=>fixture.cm.dispatch({selection:{anchor:fixture.cm.state.doc.length}}));
    assert.equal(await active.count(),0);
    const persistent=await page.locator('.cm-line').nth(2).evaluate(n=>n.getBoundingClientRect().height);
    if(!prefix.trim())assert.ok(persistent>25.9);else assert.equal(persistent,0);
  }
});
test('blank selections reveal input lines, blur collapses them and an empty document stays clickable',async()=>{
  await setup('前文\n\n\t\n\n后文');await page.locator('.cm-content').focus();
  await page.evaluate(()=>fixture.cm.dispatch({selection:{anchor:fixture.cm.state.doc.line(2).from,head:fixture.cm.state.doc.line(4).to}}));
  assert.equal(await page.locator('.tet-input-gap').count(),3);
  await page.evaluate(()=>fixture.cm.contentDOM.blur());
  await page.waitForFunction(()=>document.querySelectorAll('.tet-input-gap').length===0);
  assert.equal(await page.evaluate(()=>fixture.text()),'前文\n\n\t\n\n后文');
  await setup('');
  const empty=await page.locator('.cm-line').first().evaluate(n=>({height:n.getBoundingClientRect().height,html:n.outerHTML,line:getComputedStyle(n).lineHeight,font:getComputedStyle(n).fontSize,focus:fixture.cm.hasFocus}));
  // An empty CM document may have no visible ranges/decorations yet; its
  // native placeholder must remain clickable, not have a forced exact height.
  assert.ok(empty.height>0,JSON.stringify(empty));
  await page.locator('.cm-content').focus();await page.keyboard.type('new');assert.equal(await page.evaluate(()=>fixture.text()),'new');
  await setup('正文\n');await page.evaluate(()=>{fixture.info.getState=()=>({source:true});fixture.cm.dispatch({selection:{anchor:3}});});await page.locator('.cm-content').focus();
  assert.equal(await page.locator('.tet-input-gap').count(),0);assert.ok(await page.locator('.cm-line').last().evaluate(n=>n.getBoundingClientRect().height)>0);
});

test('multiple plain blanks retain exactly N-1 rows in live, reading and print',async()=>{
  for(let count=1;count<=4;count++) for(const mode of ['live','reading']) {
    const text='第一段'+ '\n'.repeat(count+1)+'第二段';await setup(text,mode);
    if(mode==='live') {
      assert.equal(await page.locator('.tet-extra-blank').count(),count-1);
      const heights=await page.locator('.tet-gap').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));
      assert.ok(heights[0]===0);for(const h of heights.slice(1))assert.ok(Math.abs(h-25.92)<.05);
    } else {
      assert.equal(await page.locator('.tet-extra-gap').count(),count>1?1:0);
      if(count>1)assert.ok(Math.abs((await page.locator('.tet-extra-gap').evaluate(n=>n.getBoundingClientRect().height))-(count-1)*25.92)<.05);
      await page.emulateMedia({media:'print'});
      if(count>1)assert.ok(Math.abs((await page.locator('.tet-extra-gap').evaluate(n=>n.getBoundingClientRect().height))-(count-1)*25.92)<.05);
      await page.emulateMedia({media:'screen'});
    }
    assert.equal(await page.evaluate(()=>fixture.text()),text);
    assert.equal(await page.evaluate(()=>fixture.backups.length),0);
  }
});

test('extra spaces survive native Enter/undo, focus changes, toggle and unload',async()=>{
  await setup('正文');await page.evaluate(()=>fixture.cm.dispatch({selection:{anchor:fixture.text().length}}));
  await page.locator('.cm-content').focus();for(let n=0;n<4;n++)await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>fixture.text()),'正文\n\n\n\n');
  assert.equal(await page.locator('.tet-extra-blank').count(),2);
  await page.keyboard.type('后文');await page.evaluate(()=>fixture.cm.contentDOM.blur());
  assert.equal(await page.locator('.tet-extra-blank').count(),2);
  await page.evaluate(async()=>{fixture.plugin.settings.preserveExtraBlankLines=false;await fixture.plugin.saveSettings();});
  assert.equal(await page.locator('.tet-extra-blank').count(),0);
  await setup('正文\n\n\n后文','reading');
  for(let i=0;i<3;i++)await page.evaluate(()=>fixture.plugin.saveSettings());
  assert.equal(await page.locator('.tet-extra-gap').count(),1);
  await page.evaluate(async()=>{fixture.plugin.settings.preserveExtraBlankLines=false;await fixture.plugin.saveSettings();});
  assert.equal(await page.locator('.tet-extra-gap').count(),0);
  await page.evaluate(async()=>{fixture.plugin.settings.preserveExtraBlankLines=true;await fixture.plugin.saveSettings();});
  assert.equal(await page.locator('.tet-extra-gap').count(),1);
  await page.evaluate(()=>fixture.plugin.onunload());assert.equal(await page.locator('.tet-extra-gap').count(),0);
  assert.equal(await page.evaluate(()=>fixture.text()),'正文\n\n\n后文');
});

test('reading gaps use source positions for repeated paragraphs, lists and protected code',async()=>{
  const text='相同\n\n\n相同\n\n- A\n\n- B\n\n\n相同\n\n```\n\n\n代码\n```';
  await setup(text,'reading');assert.equal(await page.locator('.tet-extra-gap').count(),2);
  assert.equal(await page.locator('pre .tet-extra-gap,li .tet-extra-gap').count(),0);
  assert.equal(await page.locator('li').count(),2);
  assert.equal(await page.evaluate(()=>fixture.text()),text);
});

test('leading/trailing extra whitespace matches reading, and formatting never removes it',async()=>{
  const text='\n\n前文\n\n\n后文\n\n\n';
  for(const mode of ['live','reading']) {
    await setup(text,mode);
    const heights=await page.locator(mode==='live'?'.tet-extra-blank':'.tet-extra-gap').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));
    assert.ok(Math.abs(heights.reduce((a,b)=>a+b,0)-4*25.92)<.1);
    assert.equal(await page.evaluate(()=>formatNote(fixture.text()).text),text);
  }
});
test('quoted paragraph separators collapse and nested lists retain equal knowledge-block gaps',async()=>{
  for(const mode of ['live','reading']) {
    await setup('> 引用一\n>\n> 引用二\n\n正文\n\n- 父级\n  - 子级一\n  - 子级二\n- 另一个父级',mode);
    if(mode==='live') {
      assert.equal(await page.locator('.tet-quote-gap').evaluate(n=>n.getBoundingClientRect().height),0);
      const starts=await page.locator('.tet-block-start').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().top+parseFloat(getComputedStyle(n).paddingTop)));
      const ends=await page.locator('.tet-block-end').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().bottom-parseFloat(getComputedStyle(n).paddingBottom)));
      assert.equal(starts.length,7);for(let i=1;i<starts.length;i++)assert.ok(Math.abs(starts[i]-ends[i-1]-8.96)<.1);
    } else {
      const ps=await page.locator('blockquote > p').evaluateAll(ns=>ns.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom,pad:parseFloat(getComputedStyle(n).paddingTop)})));
      assert.ok(Math.abs(ps[1].top+ps[1].pad-ps[0].bottom-8.96)<.1);
      const lis=await page.locator('li').evaluateAll(ns=>ns.map(n=>({top:n.getBoundingClientRect().top,pad:parseFloat(getComputedStyle(n).paddingTop),bottom:n.getBoundingClientRect().bottom,child:!!n.querySelector('ul')})));
      assert.equal(lis.length,4);for(let i=0;i<lis.length;i++)assert.equal(lis[i].pad,4.48);
      assert.ok(Math.abs(lis[2].top+lis[2].pad-lis[1].bottom+4.48-8.96)<.1);
    }
  }
});
test('physical Tab knowledge rows match list spacing in live, reading and print; disable restores native code',async()=>{
  const input='正文\n\n\tTab 第一行。\n\tTab 第二行。\n\n正文二\n\n- A\n- B';
  for(const mode of ['live','reading']) {
    await setup(input,mode);
    const selector=mode==='live'?'.tet-tab-knowledge-line':'.tet-tab-row';
    assert.equal(await page.locator(selector).count(),2);
    const boxes=await page.locator(selector).evaluateAll(ns=>ns.map(n=>{const c=getComputedStyle(n),r=n.getBoundingClientRect();return {top:r.top+parseFloat(c.paddingTop),bottom:r.bottom-parseFloat(c.paddingBottom),padding:[c.paddingTop,c.paddingBottom],line:c.lineHeight};}));
    for(const box of boxes){assert.deepEqual(box.padding,['4.48px','4.48px']);assert.equal(box.line,'25.92px');}
    assert.ok(Math.abs(boxes[1].top-boxes[0].bottom-8.96)<.1);
    const allBoxes=await page.locator(mode==='live'?'.tet-block-start':'.markdown-preview-view > p,.tet-tab-row,li').evaluateAll(ns=>ns.map(n=>{const c=getComputedStyle(n),r=n.getBoundingClientRect();return {top:r.top+parseFloat(c.paddingTop),bottom:r.bottom-parseFloat(c.paddingBottom)};}));
    for(let i=1;i<allBoxes.length;i++)assert.ok(Math.abs(allBoxes[i].top-allBoxes[i-1].bottom-8.96)<.1,mode+' Tab/prose/list boundary '+i);
    if(mode==='reading') {
      const original=await page.locator('pre code').textContent();assert.equal(original,'Tab 第一行。\nTab 第二行。\n');
      await page.emulateMedia({media:'print'});assert.equal(await page.locator('.tet-tab-row').first().evaluate(n=>getComputedStyle(n).paddingTop),'4.48px');await page.emulateMedia({media:'screen'});
      await page.evaluate(async()=>{fixture.plugin.settings.tabKnowledgeLines=false;await fixture.plugin.saveSettings();});
      assert.equal(await page.locator('.tet-tab-row').count(),0);assert.equal(await page.locator('pre code').textContent(),original);
      await page.evaluate(async()=>{fixture.plugin.settings.tabKnowledgeLines=true;await fixture.plugin.saveSettings();});assert.equal(await page.locator('.tet-tab-row').count(),2);
    }
    assert.equal(await page.evaluate(()=>fixture.text()),input);
  }
});
test('Tab knowledge wrapping gets padding once per physical line; fenced and space code are untouched',async()=>{
  const input='\t'+('很长的一条缩进知识行。'.repeat(70))+'\n\t短行。\n\n```\n真正围栏代码一\n真正围栏代码二\n```\n\n    空格缩进代码一\n    空格缩进代码二';
  for(const mode of ['live','reading']) {
    await setup(input,mode);
    const selector=mode==='live'?'.tet-tab-knowledge-line':'.tet-tab-row';
    assert.equal(await page.locator(selector).count(),2);
    const h=await page.locator(selector).first().evaluate(n=>{const c=getComputedStyle(n);return {height:n.getBoundingClientRect().height,padding:parseFloat(c.paddingTop)+parseFloat(c.paddingBottom),line:parseFloat(c.lineHeight)};});
    assert.equal(h.padding,8.96);assert.ok(h.height>h.line*3);
    if(mode==='reading'){assert.equal(await page.locator('pre:not(.tet-tab-knowledge)').count(),2);assert.equal(await page.locator('.tet-tab-row').count(),2);}
  }
  // Duplicate real code text is ambiguous: preserve native code everywhere.
  for(const mode of ['live','reading']) {
    await setup('\t相同内容\n\n```\n相同内容\n```\n\n    相同内容',mode);
    assert.equal(await page.locator(mode==='live'?'.tet-tab-knowledge-line':'.tet-tab-row').count(),0);
  }
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
