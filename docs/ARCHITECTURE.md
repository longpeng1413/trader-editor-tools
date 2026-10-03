# Architecture / 架构

## Files

| Module | Responsibility |
| --- | --- |
| `src/main.js` | 插件生命周期、命令/菜单、模态预览、设置校验、备份 |
| `src/markdown.js` | 纯函数：保守行分类、格式化插空行、图片扫描/尺寸 token、表格边界与安全写回 |
| `src/layout.js` | CM6 行装饰、跨窗口 CSS 变量、输入行可见性、Tab 知识行 postprocessor |
| `src/image-resize.js` | 源码定位、Pointer Events、覆盖层、尺寸提交、并发保护 |
| `src/text-style.js` | 选区快照、标准 HTML 包裹/清除、单事务提交 |
| `styles.css` | Live Preview / 语义阅读块 / PDF 样式和非打印控件 |
| `tests/` | 纯算法与真实 CM6/Chromium 夹具回归 |

## Formatting

1. Read editor text and conservative source classification.
2. Compute blank-line insertions, preserving original characters and line endings.
3. Show original/result. No write before confirmation.
4. Recheck file/text, save optional original backup, recheck again.
5. Apply one editor transaction; current session can undo once.

分类器不是完整 CommonMark parser。它保留 YAML、围栏代码、引用/Callout、嵌套列表、HTML、表格和不确定的多行内联语法。0.1.1 专门修复状态边界：引用不能把“直到下一个空行的所有内容”都保护起来；外部标题、列表等可立即中断引用，而真正惰性续行仍属于原块。

源码未提供空行时，合法软换行/列表续行仍按原结构解释。明确逐行分段只发生在用户格式化命令里；排版装饰不伪造新的语义段落。

0.1.3 的 Tab 知识行是明确标注的可关闭显示增强：标准 Markdown 的独立 Tab 缩进仍为代码块，不改源 Tab，不声称改变标准段落语义。仅当独立缩进块所有非空行都以 Tab 开头时，LP 每个物理行加独立留白；阅读 postprocessor 根据 section 原文与 code 文本匹配生成行 span，保留原始文本/换行。围栏、空格缩进和同文真实代码歧义保守不转换。设置变化及 unload 清理 span、恢复 code 文本；自动折行不插 DOM 换行或额外留白。PDF 使用同一渲染后行样式。

0.1.2 分类返回引用分隔行、缩进代码和普通列表续段元数据：不再把所有缩进行都当不可排版的不透明块。独立缩进代码的内部空行保留。显式格式化可分隔普通列表缩进正文，并在返回顶层正文时终止列表；不去缩进、不拆代码/多行内联表达。

## Layout

一个块上下各 0.28em；关闭主题段落/list 的额外间距；LP 结构性空行视觉高度为零。多物理行正文只在开头/末尾留白，自动折行内部只用 line-height 1.62。合法列表续行继承统一行高，末行才承担该项底部留白。

普通引用、嵌套列表、列表内已有空行的续段与独立缩进代码参与同一留白模型。阅读模式取消容器的重复 padding；列表/引用内部段落之间只留下等效 0.56em。0.1.4 移除 Enter keymap 和 paragraphEnter 设置，全部键盘编辑规则交由宿主，文档改变仅来自宿主原生编辑或明确执行的插件写入命令。

编辑器焦点/选区变化时重新计算行装饰：光标或选区覆盖的结构空行获得 tet-input-gap，保留可见行高；其他 tet-gap/tet-quote-gap 才压缩到零。失焦/移走光标恢复紧凑显示；空文档保留可点击输入区域。装饰只改变视图，不派发内容编辑，不改阅读/PDF DOM，也不增加永久块留白。

`layoutVersion:2` 用于从旧像素原型迁移设置，保留配色与功能开关。阅读与 PDF 使用语义 `p/li/h*`，打印不显示覆盖层。第三方主题仍可能改变字体、特殊容器与页宽。

## Image selection and commit

- LP 通过注册的 CM6 editorInfoField、DOM anchor 和文档偏移匹配 token。
- 表格 widget 的 DOM anchor 可能只指向表头；另用 rendered row/cell 映射到 source row/cell，排除 Markdown delimiter 行。
- 阅读模式通过 Markdown postprocessor section 信息定位；重复实例仅在源码/DOM 数量完全匹配时用顺序映射。
- 核心图片可能让 wrapper 而非 IMG 接收鼠标；Excalidraw 异步替换为 `filesource` wrapper，需要按解析后的规范路径匹配。
- 拖动只改变固定覆盖层，不触发每个 mousemove 的表格重排。
- Pointer release 校验原文未变、file 未换、表格列数不变，写一次事务或 guarded `vault.process`。
- Reading 无打开的编辑器时先备份；不在脏编辑器背后静默写文件。

优先写原生 `![[path|width]]` / Markdown alt dimensions；表格转义 pipe。别名需要原生 Markdown 表达时，转换时保留相对解析路径和说明。Excalidraw 是可选依赖；兼容 registry probe 有 guard，不使未安装绘图插件时整个插件崩溃。

## Text styles

调色板打开前捕获文本/文件/选区，确认文本仍一致后提交。仅处理明确属于本插件的完整 HTML wrapper，不全局删除第三方标签。高亮保持已有显式文字色，否则采用可读深色前景。不包裹跨段落/表格行选区。

## Maintenance risks

Obsidian 内部 editor DOM、表格 widget 和第三方 Excalidraw 渲染器可能改变。公共 API 优先，少量 registry/DOM 兼容点需注明版本并补实机验证。手写 Markdown 边界不能泛化为“所有格式均支持”；模糊结构保守处理。移动触控/软键盘仍需真机专项验收。
