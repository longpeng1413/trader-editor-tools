# Changelog

## 0.1.4 - 2026-10-03

- 插件更名为「猛人obsidian编辑插件」，设置、菜单和安装包采用中文名称；内部 ID、安装目录及仓库地址保留，已有设置、快捷键与备份不丢失。
- 恢复 Obsidian 原生编辑：移除 Enter 接管与自动分段开关，忽略旧 paragraphEnter 设置；不接管 Enter、Shift+Enter、Tab、Backspace。
- 聚焦编辑时，光标/选区所在的空白行、Tab 空行、空引用行保持可见；只压缩非活动结构空行，空白笔记仍可点击。
- 焦点变化只刷新显示，不写笔记；已验证的块间距与阅读/PDF 样式保持不变。
- 61 项回归通过（34 算法 + 27 浏览器）。真实 Windows 键盘测试验证 Tab/引用续行和空引用退出；Tab 续行与停用插件的原生结果一致。

## 0.1.3 - 2026-10-03

- Add optional Tab knowledge-row display, enabled by default: each physical line of a standalone Tab-indented block uses the same symmetric padding as list items; wrapping stays compact.
- Match Live Preview, Reading View and print styles without changing note source. Setting changes and plugin unload restore native code DOM/text.
- Preserve fenced/space-indented code; refuse conversion when identical real-code content makes matching ambiguous.
- Fix native diagnostics to place the vault selector before the CLI command.
- All 59 regressions pass, including wrapping, settings restoration and unchanged source. Native Windows measurements verify Tab rows in Live Preview and Reading View; print is covered by browser regression, not a new full native PDF export.

## 0.1.2 - 2026-10-03

- Fix missing paragraph padding for ordinary quotes, indented list paragraphs and standalone indented code; remove theme vertical margins without losing quote borders/indentation.
- Apply the same compact block gap to nested list items. Collapse quoted paragraph separator lines without collapsing real blank code lines.
- Detect two/three-space ordinary prose and preserve reference definition continuations. Indented code does not interrupt a prose paragraph without a blank line.
- Formatting optionally separates plain indented list paragraphs, keeps indentation/nesting, and handles return to unindented prose. Existing notes are never rewritten automatically.
- Add optional ordinary-prose Enter enhancement using standard blank lines; native list/quote/code/source-mode behavior remains available.
- Add a public mixed-block regression sample. All 57 regressions pass, including real CM6/Chromium gap measurements and Enter/undo tests; native Windows layout measurements cover Live Preview and Reading View.

## 0.1.1 - 2026-10-03

### Fixed

- 引用紧接外部标题/列表时，不再把后续全部行错误保护为引用续行。
- 围栏代码、水平线、HTML 等明确边界会结束引用状态；有序列表遵守以 1 开始的段落中断规则。
- 标题能够结束列表惰性续行；合法列表续行使用统一行高，底部块留白只在续行末尾添加。
- 格式化可为明确的顶层引用边界添加标准空行，保持引用内部、Callout 和嵌套结构。

### Added

- 引用边界、惰性续行与标准阅读结构回归测试；总计 51 项。
- 中英文使用文档、架构/贡献/发布指南、问题模板、CI 和发布工作流。
- GitHub Releases 安装包、完整源码包及 Obsidian 原生运行文件。

## 0.1.0 - 2026-10-03

- Initial local version: conservative paragraph formatting with preview/backup/undo.
- Verified compact em-padding layout with a 1.62 body line-height.
- Persistent native image resizing, including Excalidraw and escaped Markdown table cells.
- Text color, highlight, underline and clear-style commands, configurable palette and hotkey slots.
- Reading/PDF styles and 45 original automated regression tests.
