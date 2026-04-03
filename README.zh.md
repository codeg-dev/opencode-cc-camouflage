# opencode-cc-camouflage

OpenCode 的配套维护插件，用于帮助验证、应用和恢复与 Anthropic auth 插件相关的补丁。本包不是上游项目的分支。它提供显式工具，不包含自动钩子。

## 这是什么

`opencode-cc-camouflage` 是一个维护插件，具有以下功能：

- 在任何修改之前验证补丁安全性
- 根据你的明确请求向 peer 插件应用补丁
- 在需要回滚时恢复补丁
- 报告状态并提供诊断指导

它在安装期间不会自动打补丁。所有变更都需要显式调用工具。

## 前置条件和安装顺序

安装顺序很重要。在使用本插件之前，你必须先完成以下步骤：

1. **`not-claude-code-emulator`** (commit `5541e5c`)
   - 提供 Anthropic 兼容接口的消息运行时
   - 克隆到 `~/github/not-claude-code-emulator`

2. **`opencode-anthropic-auth`** (commit `6594dd1`)
   - 处理 Anthropic OAuth 的 peer 插件
   - 作为 OpenCode 插件与本包一起安装

3. **`opencode-cc-camouflage`** (本包)
   - 最后安装，在模拟器和 peer 插件就位之后

详细步骤请参阅 [docs/install.md](docs/install.md)。

## 可用工具

本插件提供四个显式工具。它们不是自动钩子。

### `status`

报告 peer 安装的当前状态。

```bash
bun run status
```

输出格式为机器可读：

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

退出码 0 表示健康。退出码 1 表示需要关注。

### `doctor`

根据当前状态提供诊断指导。

```bash
bun run doctor
```

这会检查文件并报告可操作的下一步。它不会安装、打补丁或修改任何内容。它只读取和报告。

### `patch_apply`

将固定补丁应用到 peer 插件。

```bash
bun run patch:apply
```

这需要：
- peer 插件必须存在
- 补丁预检检查必须通过
- peer 根目录必须可写

它会在修改文件之前创建回滚标记。

### `patch_revert`

恢复先前应用的补丁。

```bash
bun run patch:revert
```

这使用回滚标记来恢复打补丁前的状态。标记必须与当前补丁哈希匹配才能继续恢复。

## 为什么自动钩子仅限于验证

本插件中的自动钩子（`command.execute.before`、`tool.execute.after`）仅限于验证和元数据。它们不会自动应用补丁，因为：

1. 未经用户明确意图就修改 peer 插件违反了最小意外原则
2. 补丁失败需要人工审查，而不是静默重试
3. 回滚需要明确同意才能恢复状态

当检测到漂移时，钩子会发出警告。你决定是应用、恢复还是保持环境不变。

## 平台支持

| 平台 | 状态 | 说明 |
|----------|--------|-------|
| macOS    | 支持 | 主要桌面环境 |
| Linux    | 支持 | 相同的固定上游组件 |
| Windows  | 不支持 | 无 v1 承诺 |

固定组件版本请参阅 [docs/support-matrix.md](docs/support-matrix.md)。

## 回滚

如果你需要撤销补丁应用：

```bash
bun run patch:revert
```

具体步骤和故障排除请参阅 [docs/rollback.md](docs/rollback.md)。

## 兼容性金丝雀

要检查与固定目标的上游漂移：

```bash
bun run compat:canary
```

这是一个只读检查，用于验证组件完整性和上游引用，不会修改任何内容。在固定的支持目标上退出码为 0。

金丝雀工作流的详细信息请参阅 [docs/next-release.md](docs/next-release.md)。

## 文档

- [docs/install.md](docs/install.md) - 前置条件和安装步骤
- [docs/rollback.md](docs/rollback.md) - 具体回滚步骤
- [docs/compatibility.md](docs/compatibility.md) - 兼容性边界
- [docs/next-release.md](docs/next-release.md) - 上游漂移金丝雀
- [docs/support-matrix.md](docs/support-matrix.md) - 固定组件版本
- [docs/non-goals.md](docs/non-goals.md) - 明确超出范围的项目
- [docs/patch-inventory.md](docs/patch-inventory.md) - 补丁资源分类
- [docs/upstream-locks.md](docs/upstream-locks.md) - 开发组件引用

## 开发

```bash
# 安装依赖
bun install

# 类型检查
bun run typecheck

# 运行测试
bun run test:unit
bun run test:integration

# 验证组件补丁
bun run verify:patches

# 检查发布安全性
bun run check:publish-safety
```

## 许可证

MIT

<!-- i18n:source-hash:bbc8ec6a2d5a415af5cd25da87d0af8e98de204a7cfc69f8edb6846ce44a3404 -->
