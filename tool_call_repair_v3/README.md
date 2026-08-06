# tool_call_repair v0.3.0（治本升级版）

基于 Operit 新测试版本（1.12.0+8）hook 能力的升级版。在 v0.2.0 兜底基础上，新增治本层，从源头预防坏结构。

> 注：v0.2.0 留档见仓库 `tool_call_repair/` 文件夹；本文件夹（`tool_call_repair_v3/`）为 v0.3.0 治本升级版。

## 与 v0.2.0 的区别

| 层 | v0.2.0 | v0.3.0 |
|---|---|---|
| 兜底 | `tool_call_intercept` block+repair_note | 保留（不变） |
| 治本（新增） | 无 | `ToolPromptCompose`(filter_tool_prompt_items)：改写 `package_proxy` 工具定义，注入参数规范 |
| 治本辅助（新增） | 无 | `SystemPromptCompose`(after_compose_system_prompt)：向 system prompt 注入调用规则 |

## 背景

Operit 1.12.0+8 长会话下 `package_proxy` 调用失败（`Exactly one tool_name parameter is required`）。GitHub #856 跟踪，作者建议借鉴 Command Code 的确定性修复层。

新测试版本新增 `ToolPromptCompose` / `SystemPromptCompose` hook，可在模型生成前从工具定义 / 系统提示层预防坏结构（治本），与既有 `tool_call_intercept` 兜底互补。

## 安装

1. 下载 `com.operit.tool_call_repair.toolpkg`
2. Operit 平台 `debug_install_toolpkg` 安装
3. 启用插件

## 能力边界

- `tool_call_intercept` 仍仅 `{action:"allow"}` / `{action:"block",reason}`（无 `replace` / 参数替换通道）
- 治本 hook 仅只读 eventPayload、返回新对象、异常返回 null、注册失败不影响兜底
- 所有新增 hook 均 try-catch 保护，绝不 mutate 输入

## 测试

- 单测 22/22（`test_main.js`，含 S15–S21 治本层用例）
- 兜底实测：正常放行 / 坏结构拦截（参数原文+照抄示范，不嵌套）/ 照抄成功

## 关联

- GitHub Issue [#856](https://github.com/AAswordman/Operit/issues/856)
- 仓库留档：`tool_call_repair/`（v0.2.0）
