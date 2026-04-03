# opencode-cc-camouflage

OpenCode 的配套維護外掛程式，協助驗證、套用和還原與 Anthropic 驗證外掛相關的修補檔。此套件並非上游專案的分支，它提供明確的工具，不會自動掛鉤。

## 這是什麼

`opencode-cc-camouflage` 是一個維護外掛程式，具備以下功能：

- 在任何修改前驗證修補檔的安全性
- 在您明確要求時套用修補檔至對等外掛
- 在需要回復時還原修補檔
- 回報狀態並提供診斷指引

它在安裝期間不會自動修補。所有變更都需要明確呼叫工具。

## 先決條件與安裝順序

安裝順序很重要。您必須先準備好以下項目，此外掛程式才能運作：

1. **`not-claude-code-emulator`** (提交 `5541e5c`)
   - 提供 Anthropic 相容介面的訊息執行階段
   - 複製到 `~/github/not-claude-code-emulator`

2. **`opencode-anthropic-auth`** (提交 `6594dd1`)
   - 處理 Anthropic OAuth 的對等外掛
   - 與此套件一同作為 OpenCode 外掛安裝

3. **`opencode-cc-camouflage`** (此套件)
   - 最後安裝，在模擬器和對等外掛就位之後

詳細步驟請參閱 [docs/install.md](docs/install.md)。

## 可用工具

此外掛程式提供四個明確的工具。它們不是自動掛鉤。

### `status`

回報對等安裝的目前狀態。

```bash
bun run status
```

輸出格式為機器可讀：

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

結束代碼 0 表示正常。結束代碼 1 表示需要注意某些事項。

### `doctor`

根據目前狀態提供診斷指引。

```bash
bun run doctor
```

這會檢查檔案並回報可執行的後續步驟。它不會安裝、修補或修改任何內容。它只會讀取並回報。

### `patch_apply`

套用固定的修補檔至對等外掛。

```bash
bun run patch:apply
```

這需要：
- 對等外掛必須存在
- 修補檔預檢查必須通過
- 對等外掛根目錄必須可寫入

它會在修改檔案前建立回復標記。

### `patch_revert`

還原先前套用的修補檔。

```bash
bun run patch:revert
```

這會使用回復標記來還原修補前的狀態。標記必須符合目前的修補檔雜湊值，還原才能繼續。

## 為什麼自動掛鉤僅限驗證

此外掛程式中的自動掛鉤（`command.execute.before`、`tool.execute.after`）僅限於驗證和中繼資料。它們不會自動套用修補檔，原因如下：

1. 在沒有明確使用者意圖的情況下修改對等外掛，違反了最小驚訝原則
2. 修補失敗需要人工審查，而不是無聲重試
3. 回復需要明確同意才能還原狀態

當偵測到漂移時，掛鉤會發出警告。您決定要套用、還原，還是保持環境不變。

## 平台支援

| 平台 | 狀態 | 說明 |
|----------|--------|-------|
| macOS    | 支援 | 主要桌面環境 |
| Linux    | 支援 | 相同的固定上游元件 |
| Windows  | 不支援 | 無 v1 承諾 |

固定元件版本請參閱 [docs/support-matrix.md](docs/support-matrix.md)。

## 回復

如果您需要撤銷修補檔套用：

```bash
bun run patch:revert
```

具體步驟和疑難排解請參閱 [docs/rollback.md](docs/rollback.md)。

## 相容性金絲雀

檢查與固定目標的上游漂移：

```bash
bun run compat:canary
```

這是唯讀檢查，驗證元件完整性和上游參照，不會修改任何內容。在固定的支援目標上，結束代碼為 0。

金絲雀工作流程的詳細資訊請參閱 [docs/next-release.md](docs/next-release.md)。

## 文件

- [docs/install.md](docs/install.md) - 先決條件與安裝步驟
- [docs/rollback.md](docs/rollback.md) - 具體回復步驟
- [docs/compatibility.md](docs/compatibility.md) - 相容性邊界
- [docs/next-release.md](docs/next-release.md) - 上游漂移金絲雀
- [docs/support-matrix.md](docs/support-matrix.md) - 固定元件版本
- [docs/non-goals.md](docs/non-goals.md) - 明確排除範圍項目
- [docs/patch-inventory.md](docs/patch-inventory.md) - 修補檔資產分類
- [docs/upstream-locks.md](docs/upstream-locks.md) - 開發元件參照

## 開發

```bash
# 安裝相依性
bun install

# 型別檢查
bun run typecheck

# 執行測試
bun run test:unit
bun run test:integration

# 驗證修補檔與元件
bun run verify:patches

# 檢查發布安全性
bun run check:publish-safety
```

## 授權條款

MIT

<!-- i18n:source-hash:bbc8ec6a2d5a415af5cd25da87d0af8e98de204a7cfc69f8edb6846ce44a3404 -->
