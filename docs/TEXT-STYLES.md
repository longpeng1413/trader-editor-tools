# 文字样式：语义与视觉分离

## 根因

旧版每个命令分别包裹 span / mark / u，没有统一的属性与语义模型。Markdown 被包在 HTML 内时，Live Preview 可能直接显示原始标记；即使标记移到外层，Obsidian 1.13.7 的 inline HTML widget 仍可能不继承外层粗体。Reading 正常不代表 Live Preview 正常。

## 持久格式与操作

```markdown
**<span data-mengren-style="1" style="color: #d64545; background-color: #ffe1bd; text-decoration: underline;">重要内容</span>**
```

1. 获取文件、文本、选区快照；拒绝跨物理行或表格单元格。
2. Marked Lexer 解析行内树，保留原生 delimiter / link bytes；不将渲染 HTML 反向转成 Markdown。
3. 读取带归属标记或精确旧版视觉标签的属性，合并继承属性，识别受保护节点。
4. 仅在选中的可编辑文字节点改变目标属性；下划线切换以选区是否全部带下划线判断。
5. 将视觉属性输出到单个 owned span；语义 delimiter 在外层，相邻同属性片段合并，无属性则不输出标签。
6. 文本/文件仍一致时，一次 editor.transaction 提交。无内容改变不生成额外 Undo。

同一文字片段的三类样式不会相互覆盖。跨原生语义边界或仅设置部分文字时，需要多个兄弟 span；它们不是重复嵌套。源码中从不写入 font-weight、font-style 或删除线来替代 Markdown 语义。

独立命令 ID：`style-clear-color`、`style-clear-highlight`、`style-clear-underline`。原 `style-clear` ID 保持兼容，现在表示清除全部插件样式。清除命令不会删除原 Markdown 强调或第三方 CSS。

## Live Preview

`text-style-view.js` 为已渲染的 owned span 派生临时语义类。HTML widget 的源位置通过 `posAtDOM` 关联；异步 DOM 更新通过 MutationObserver 重新测量。外层 Markdown 改变时刷新类，停用时清理。Reading 与 PDF 原生 strong/em/del 负责语义，不依赖此显示补偿。插件停用后源码仍可移植，但 LP 的语义补偿不再运行。

## 保护与边界

- 普通/引用式 Markdown 链接的显示文字支持样式；链接地址和标题原字节保留。
- 行内代码、wiki 链接/嵌入、转义符、图片及自动链接不插入视觉 HTML。混合选区保留它们，只修改可编辑文字；纯受保护选区提示拒绝。
- 不支持跨物理行/单元格的样式操作，代码块/YAML 不写入；未闭合/跨行 HTML 保守拒绝。
- 外来标签属性或未知 CSS 不属于清除范围。新版归属标记不可随意修改；被外部工具重排属性后可能保守视为外来标签。
- 精确旧 color span、旧 mark 和 `<u>` 只有操作时兼容；同形手写标签无法与旧插件输出绝对区分。旧自动 `#202020` 前景不再视为显式文字色，已有独立 color 优先。
- 高亮不再自动改变文字色。深色主题+浅色高亮+默认浅色字可能低对比，请明确设置合适文字色。
- Android、所有第三方主题/Markdown 扩展未全面真机测试。遇到不确定语法先在匿名测试笔记中验证，不应承诺所有 Markdown 方言兼容。

没有打开笔记时批量重写或自动迁移。范围与证据见 [TESTING](../TESTING.md)。
