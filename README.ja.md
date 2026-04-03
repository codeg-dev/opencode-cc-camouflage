# opencode-cc-camouflage

OpenCode用のコンパニオンメンテナンスプラグインで、Anthropic認証プラグインに関連するパッチの検証、適用、および元に戻す作業を支援します。このパッケージはアップストリームプロジェクトのフォークではありません。自動フックなしで明示的なツールを提供します。

## 概要

`opencode-cc-camouflage` は以下の機能を持つメンテナンスプラグインです:

- 変更前のパッチ安全性を検証
- 明示的なリクエスト時にピアプラグインにパッチを適用
- ロールバックが必要な際にパッチを元に戻す
- ステータスを報告し、診断ガイダンスを提供

インストール時に自動的にパッチを適用することはありません。すべての変更には明示的なツール呼び出しが必要です。

## 前提条件とインストール順序

インストール順序は重要です。このプラグインが機能するには、以下が事前に整備されている必要があります:

1. **`not-claude-code-emulator`** (コミット `5541e5c`)
   - Anthropic互換インターフェースを提供するメッセージランタイム
   - `~/github/not-claude-code-emulator` にクローン

2. **`opencode-anthropic-auth`** (コミット `6594dd1`)
   - Anthropic OAuthを処理するピアプラグイン
   - このパッケージと並行してOpenCodeプラグインとしてインストール

3. **`opencode-cc-camouflage`** (このパッケージ)
   - 最後にインストール、エミュレータとピアプラグインが整備された後

詳細な手順は [docs/install.md](docs/install.md) を参照してください。

## 利用可能なツール

このプラグインは4つの明示的なツールを公開しています。自動フックではありません。

### `status`

ピアインストールの現在の状態を報告します。

```bash
bun run status
```

出力形式は機械可読です:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

終了コード0は正常を意味します。終了コード1は注意が必要な状態を示します。

### `doctor`

現在の状態に基づいて診断ガイダンスを提供します。

```bash
bun run doctor
```

これはファイルを検査し、実行可能な次のステップを報告します。インストール、パッチ適用、変更は行いません。読み取りと報告のみを行います。

### `patch_apply`

ピアプラグインに固定されたパッチを適用します。

```bash
bun run patch:apply
```

これには以下が必要です:
- ピアプラグインが存在すること
- パッチ事前検査に合格すること
- 書き込み可能なピアルート

ファイルを変更する前にロールバックマーカーを作成します。

### `patch_revert`

以前に適用されたパッチを元に戻します。

```bash
bun run patch:revert
```

これはロールバックマーカーを使用して、パッチ適用前の状態を復元します。マーカーは現在のパッチハッシュと一致している必要があり、元に戻す処理が進行します。

## 自動フックが検証専用である理由

このプラグインの自動フック (`command.execute.before`, `tool.execute.after`) は、検証とメタデータに限定されています。自動的にパッチを適用しないのは以下の理由によります:

1. 明示的なユーザー意向なしにピアプラグインを変更することは、最小驚きの原則に反する
2. パッチ適用の失敗には人間によるレビューが必要であり、黙って再試行すべきではない
3. ロールバックには状態を復元するための明示的な同意が必要

フックはドリフトが検出された際に警告します。適用するか、元に戻すか、環境を変更しないままにするかは、あなたが決定します。

## プラットフォームサポート

| プラットフォーム | ステータス | 備考 |
|----------|--------|-------|
| macOS    | サポート対象 | プライマリデスクトップ環境 |
| Linux    | サポート対象 | 同じ固定アップストリームフィクスチャ |
| Windows  | 非サポート | v1での保証なし |

ロックされたフィクスチャバージョンについては [docs/support-matrix.md](docs/support-matrix.md) を参照してください。

## ロールバック

パッチ適用を元に戻す必要がある場合:

```bash
bun run patch:revert
```

具体的な手順とトラブルシューティングについては [docs/rollback.md](docs/rollback.md) を参照してください。

## 互換性キャナリー

固定ターゲットに対するアップストリームドリフトをチェックするには:

```bash
bun run compat:canary
```

これは読み取り専用のチェックで、フィクスチャの整合性とアップストリーム参照を検証し、何も変更しません。固定されたサポート対象ターゲットでは終了コード0になります。

キャナリーワークフローの詳細については [docs/next-release.md](docs/next-release.md) を参照してください。

## ドキュメント

- [docs/install.md](docs/install.md) - 前提条件とインストール手順
- [docs/rollback.md](docs/rollback.md) - 具体的なロールバック手順
- [docs/compatibility.md](docs/compatibility.md) - 互換性の境界
- [docs/next-release.md](docs/next-release.md) - アップストリームドリフトキャナリー
- [docs/support-matrix.md](docs/support-matrix.md) - ロックされたフィクスチャバージョン
- [docs/non-goals.md](docs/non-goals.md) - 明示的なスコープ外項目
- [docs/patch-inventory.md](docs/patch-inventory.md) - パッチアセット分類
- [docs/upstream-locks.md](docs/upstream-locks.md) - 開発フィクスチャ参照

## 開発

```bash
# 依存関係のインストール
bun install

# 型チェック
bun run typecheck

# テストの実行
bun run test:unit
bun run test:integration

# フィクスチャに対するパッチの検証
bun run verify:patches

# 公開安全性のチェック
bun run check:publish-safety
```

## ライセンス

MIT

<!-- i18n:source-hash:bbc8ec6a2d5a415af5cd25da87d0af8e98de204a7cfc69f8edb6846ce44a3404 -->
