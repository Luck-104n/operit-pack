# tool_call_repair（工具调用修复层）

复刻 Command Code 的 Tool Call Repair 确定性修复层，作为 Operit ToolPkg 插件实现。

## 背景

Operit 1.12.0+8 长会话（40 万 token）下，AI 经 `package_proxy` 调用包工具全量报 `Exactly one tool_name parameter is required`（GitHub #856）。

根因链：长会话上下文退化 → 模型把整个调用并成单 `params` 字符串（`tool_name` 缺失/错位）→ 平台原样透传 → `parseProxyInvocation` 找不到独立 `tool_name` 报错。

## 本插件做什么

- 挂载点：`ToolPkg.registerToolLifecycleHook("tool_call_intercept")`；
- 检测 package_proxy 参数漂移（tool_name 错位/缺失/别名键）时 **block + repair_note**：
  - 问题诊断（tool_name 被塞进 params JSON 内部 / 别名键等）；
  - **参数原文**（平台实际收到的参数）；
  - **照抄示范**（重组后的完整调用，模型下一轮直接照抄即可修复，不嵌套）；
- 类型漂移仅 HINT 不 block（防误伤）；非 package_proxy 工具 MVP 阶段不拦截；
- 原则：只修复无语义歧义的问题，绝不猜命令/路径/内容。

## 能力边界（重要）

`tool_call_intercept` hook 仅 `{action:"allow"}` / `{action:"block", reason}`，**无参数替换通道**；修改 `event.eventPayload` 抛 `IllegalStateException`。因此本插件只能"block + 纠正"，无法"静默修复放行"（平台需提供 `action:"replace"` 通道才能落地 Command Code 式静默修复）。

## 文件结构

```
tool_call_repair/
├── manifest.json                  # ToolPkg 清单（v0.2.0）
├── com.operit.tool_call_repair.toolpkg  # 打包交付物（可直接安装）
├── dist/main.js                   # 核心实现
└── test_main.js                   # 单测 15/15（S13 真实退化场景 / S14 嵌套 bug 回归）
```

## 安装

1. 将 `com.operit.tool_call_repair.toolpkg` 放入 Operit 外部 packages 目录；
2. 平台包列表启用；
3. 或 `debug_install_toolpkg(source_path=<目录>)` 全新安装（返回 Unknown error 为无害返回码）。

## 注意（防崩 SOP）

- **禁止覆盖安装**带 hook 的 ToolPkg（hook 重复注册崩）；
- **禁止直接删已启用 hook 的包文件**（hook 脚本不可达崩，需重启）；
- 更新/卸载 = `set_sandbox_package_enabled(false)` 禁用注销 → 删文件 → 全新安装。

## 相关 Issue

- GitHub #856：工具调用间歇性失效/通道烧毁（DeepSeek V4 工具调用退化）——本插件为该 Issue 的 Command Code 修复层实现。
