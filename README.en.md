# Trader Editor Tools

An MIT-licensed Obsidian plugin for compact Markdown layout, persistent image resizing, text colors, highlights and underlines. Maintained by [longpeng1413](https://github.com/longpeng1413).

[中文说明](README.md) · [Releases](https://github.com/longpeng1413/trader-editor-tools/releases/latest) · [Contributing](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Testing](TESTING.md)

## Install

Download `trader-editor-tools-0.1.1-install.zip` from Releases. Extract the inner `trader-editor-tools` folder into **your vault**, not the Obsidian program directory:

```text
VAULT/.obsidian/plugins/trader-editor-tools/
  manifest.json
  main.js
  styles.css
```

Enable **Trader Editor Tools** in Settings → Community plugins. Avoid an extra outer directory. Keep Excalidraw installed if you use drawings; this plugin does not replace it. The plugin is **not yet listed in the Obsidian community directory**.

For upgrades, disable the plugin, replace its runtime files, and enable it again. Preserve your `data.json` and `backups/` directory.

## Features

- Standard Markdown paragraph formatting, with preview, optional local backup and one editor undo transaction. Existing notes are never reformatted automatically.
- Compact layout: body line-height 1.62; paragraphs and top-level list items have 0.28em padding on each side. No extra native paragraph/list gap is stacked on top.
- Symmetric heading padding: H1 0.95em, H2 0.82em, H3 0.70em, H4–H6 0.58em on each side.
- Click an image and drag any corner to resize proportionally; hold Alt for independent width/height. Dimensions are saved using Obsidian's native embed/alt syntax.
- Markdown table images and Excalidraw embeds are supported. The table pipe is escaped and column counts are validated before writing.
- Selection colors, background highlights, underlines and clear-style commands, available through the editor context menu, command palette and user-assigned hotkeys. Colors are customizable Hex values stored in readable standard HTML.
- Reading View and PDF share semantic block styles. PDF controls are hidden and colors preserved.

Version 0.1.1 fixes quote boundaries: a heading/list directly after a quote no longer loses Live Preview layout. Genuine lazy quote/list continuations and nested content remain protected.

## Safety and limits

No telemetry, network calls or external service is used by the plugin. Formatting runs only after preview confirmation; resizing writes only after release/save. Stale document or ambiguous image matches are rejected. Backups remain local and are never automatically deleted.

Formatting is conservative, not a complete Markdown parser/reflow engine. If a note uses physical soft line breaks deliberately, turn off per-line paragraph splitting. Quotes/Callouts, nested lists, YAML, code and uncertain inline constructs are protected. Semantic paragraph conversion requires an explicit formatting command, not visual CSS tricks.

Windows / Obsidian 1.13.7 / default theme / Excalidraw 2.27.3 have native testing evidence. Other themes, complex HTML and third-party rendering variants may differ. Android/iOS installation is permitted by the manifest, but **mobile touch and keyboard behavior have not been tested on real devices**. There is no enhanced Enter mode or mobile floating toolbar in this version.

Text styling is intended for single-paragraph selections. It is not a full rich-text editor; Markdown inside HTML and partially selected existing markup may render differently. Free height is renderer-dependent for some drawing formats; proportional width is recommended.

## Mobile use

Enable editing, select text, then open Obsidian's command palette and run the text color/highlight/underline command. You can add these commands to the mobile toolbar. Sync the plugin runtime files and optionally `data.json`; check whether your sync tool includes hidden `.obsidian` files. Excalidraw must also be enabled on each device.

## Develop

Use Node.js 22+ and pnpm 9:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Browser tests default to Windows Edge. Set `TET_BROWSER` to another Chromium executable, or install the pinned Playwright Chromium and point the environment variable to `require('playwright').chromium.executablePath()`. Fixtures use real CodeMirror 6, but mock the Obsidian API and drawing renderer.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and test guidelines and [docs/RELEASING.md](docs/RELEASING.md) for tag-based releases.

Please report bugs with **anonymized minimal Markdown**, Obsidian/plugin versions and editor mode. Do not upload your complete vault, backups, account information or private attachments.
