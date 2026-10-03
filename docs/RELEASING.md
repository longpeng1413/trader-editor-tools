# Releasing / 发布流程

GitHub Releases 是手动安装渠道；它不等于 Obsidian 社区市场上架。

## Before tagging

1. 所有回归测试通过；涉及行为修改时做独立测试库实机验证。
2. 同步 `manifest.json`、`package.json`、`versions.json`、README 版本、CHANGELOG 和 TESTING；构建 banner 自动读 manifest。
3. `pnpm install --frozen-lockfile`、`pnpm build`、`pnpm test`。
4. `pwsh -File scripts/package.ps1 -OutputDirectory ./dist`；确认安装 ZIP 是单层 `trader-editor-tools/`，不含 `data.json`、`backups/`、私人笔记或 `node_modules`。
5. 检查 Git diff 和公开内容。只提交源代码、通用示例、说明、构建结果和工作流。
6. Commit and push `main`；等待 CI 通过。

## Tag and release

Tag 必须与 manifest 的版本完全一致，不加 `v`（例如 `0.1.1`）：

```sh
git tag -a 0.1.1 -m "Release 0.1.1"
git push origin 0.1.1
```

`release.yml` 验证 tag/manifest/package 版本一致，重新构建和运行纯算法测试，用打包脚本生成 ZIP，通过仓库临时 `GITHUB_TOKEN` 发布 Release。Token 不写入代码或日志，不需维护者存长期密钥。

Release assets:

- `manifest.json`, `main.js`, `styles.css`, `versions.json`
- `trader-editor-tools-VERSION-install.zip`
- `trader-editor-tools-VERSION-source.zip`

先保留默认 pnpm 锁文件。源码包不含开发依赖、账户凭据、vault 设置/备份；包含 CI 和全部公开文档。发布时不要覆盖已有不同内容的同版本 tag/ZIP；修复应增加新版本。

## Verify after publishing

检查 Release URL、assets 和公开默认分支；从 GitHub 下载运行文件核对 hash。验证 CI/release workflow 成功，必要时看失败日志而不是重复发布。对已安装 vault 升级只替换运行文件，保留用户 `data.json` 和备份。

## Community directory

将来提交 Obsidian 社区列表前，复核当前官方提交规则、API 和 manifest 要求，包含 MIT LICENSE、公开 README、正确的 tag/Release 资产并等待审核。不要在 README 宣称已上架，直到审核和列表确实完成。
