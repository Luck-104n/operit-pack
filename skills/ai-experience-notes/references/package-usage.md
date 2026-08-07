# Operit 包使用经验

## 工具组合模式

<!-- 演进: 2026-06-06 | 来源: 日常使用整理 | 类型: pattern -->

### 模式1：深度研究 + 成果记录
1. 用 `deep_research_agent_v3_2_v4:start_research` 发起研究
2. 研究完成后，用包内的演进格式记录关键发现到 references/
3. 如果发现可复用模板，创建到 templates/

### 模式2：Android app 开发 + 编译排错
1. 用 `super_admin:terminal` 创建工程文件
2. Gradle 编译出错时，查 references/ 下的排错文档
3. 编译成功 → 记录本次排错经验到 references/

### 模式3：文件格式转换流水线
1. 用 `find_files` 找到源文件
2. 用 `file_converter` 转换格式
3. 用 `extended_file_tools:move_file` 移动到目标目录

---

## 常用包功能速查

| 包名 | 核心用途 | 常用工具 |
|------|---------|---------|
| `super_admin` | 终端命令 + 系统 Shell | `terminal`, `terminal_getscreen`, `shell` |
| `operit_editor` | 平台配置/包管理/模型配置 | `list_model_configs`, `create_model_config`, `get_function_model_config` |
| `code_runner` | 执行代码脚本 | `run_python`, `run_javascript` |
| `duckduckgo` | 网络搜索 | `web_search` |
| `various_search` | 多平台搜索 | `search` |
| `extended_file_tools` | 文件操作 | `move_file`, `copy_file`, `unzip_files` |
| `shizuku_manager` | Shizuku 服务管理 | `start_shizuku`, `stop_shizuku` |
| `ffmpeg` | 多媒体处理 | `ffmpeg_command` |
| `file_converter` | 文件格式转换 | 各种转换工具 |

---

## Operit 平台特性

<!-- 演进: 2026-06-06 | 来源: 自我进化MY包创建 | 类型: tip -->

### 1. SKILL.md 简介不支持换行

SKILL.md 的 frontmatter 中 `description` 字段如果使用 YAML 多行语法（`|` 管道符），Operit 的技能列表简介栏**只显示第一行第一个字符**。

**正确写法**：使用单行文本，用引号包裹。

```yaml
# ❌ 错误：多行语法，简介只显示第一个字
description: |
  核心技能：自动记录排错方案...
  触发关键词：自我进化 经验记录...

# ✅ 正确：单行文本，完整显示
description: '核心技能：自动记录排错方案和最佳实践。触发：自我进化 经验记录 知识沉淀...'
```

---

### 2. 包修改无需重启 Operit

Operit 的技能包（Skill）修改后**不需要重启应用**就能看到变化。Operit 会在下次读取该技能时重新加载 SKILL.md 内容。修改 SKILL.md 或 references/ 下的文件后，直接刷新或重新触发即可生效。

---

<!-- 演进: 2026-06-06 | 来源: 自我进化MY包创建 | 类型: pattern -->

### 3. 追加新经验到已有文件

向 references/ 下的已有 .md 文件追加新经验：

```bash
cat >> /sdcard/Download/Operit/skills/实操笔记/references/xxx.md << 'EOF'

<!-- 演进: YYYY-MM-DD | 来源: <场景> | 类型: pattern|troubleshoot|tip -->

### 新经验标题

新经验内容...
EOF
```

修改已有段落用 `edit_file`（安全规则见 SKILL.md）。

每条新经验顶部加上演进标记：
```markdown
<!-- 演进: YYYY-MM-DD | 来源: <场景> | 类型: pattern|troubleshoot|tip -->
```

验证：保存后无需重启 Operit，刷新即可生效。

---

## 本次对话新增（2026-06-19）

<!-- 演进: 2026-06-19 | 来源: 自我进化插件开发 | 类型: troubleshoot -->

### METADATA 格式铁律

**问题**: `debug_install_js_package` 或 PackageManager 扫描时报 `MissingFieldException`

**原因**: METADATA 块格式不标准。解析器要求 `/*`、`METADATA`、`{` 各占一行。

正确:
```
/*
METADATA
{
  "name": "xxx",
  ...
}
*/
```
错误:
```
/* METADATA
{
  ...
}
*/
```

<!-- 演进: 2026-06-19 | 来源: 自我进化插件部署 | 类型: pattern -->

### Sandbox 包手动部署工作流（Shizuku不可用时）

1. Terminal 或沙箱 Linux env 写入 `/sdcard/Android/data/com.ai.assistance.operit/files/packages/xxx.js`
2. Java Bridge 发广播刷新
3. `set_sandbox_package_enabled(name, true)` 启用
4. 缓存问题：先 disable 再 enable

<!-- 演进: 2026-06-19 | 来源: 自我进化插件开发 | 类型: pattern -->

### Operit 文件系统双环境

- `android` env: 走 Shizuku。例外：`/data/user/0/.../files/` 无需 Shizuku
- `linux` env: 走 proot，可读写 `/sdcard/`，不需 Shizuku
- 写工作区→android；写/sdcard→linux；读文件→linux更稳定

<!-- 演进: 2026-06-19 | 来源: 自我进化插件开发 | 类型: tip -->

### 工作区依赖规则

需工作区：创建/编辑项目文件、debug_install_*、插件开发
不需：package_proxy、read_file(linux)、查询已有文件

<!-- 演进: 2026-06-19 | 来源: GitHub Issues 查询 | 类型: tip -->

### 外部 HTTP 请求（无需Shizuku）

沙箱 `Tools.Net.httpGet(url, headers, 'linux')` 可直接请求外部API

<!-- 演进: 2026-06-19 | 来源: 自我进化插件安装 | 类型: troubleshoot -->

### debug_install_* 系列 Unknown error

`debug_install_js_package` 和 `debug_install_toolpkg` 返回 Unknown error。
GitHub Issues 中0条匹配（未报告bug）。绕过方案见"手动部署工作流"。

<!-- 演进: 2026-07-14 | 来源: task_orchestrator Skill 优化 | 类型: tip -->

### 内置包的双名机制：packageName vs displayName

`list_sandbox_packages` 返回的每条记录同时包含两个名称字段：

| 字段 | 用途 | 示例 |
|------|------|------|
| `packageName` | 内部标识，用于工具调用（`use_package`、`set_sandbox_package_enabled`） | `operit_editor` |
| `displayName` | UI 显示名，用户在工具箱列表中看到的名称 | `Operit平台编辑器` |

**常见映射表**：

| packageName | displayName |
|---|---|
| `operit_editor` | Operit平台编辑器 |
| `extended_chat` | 增强对话 |
| `com.operit.task_orchestrator` | 任务编排器 |
| `system_tools` | 系统工具 |
| `workflow` | 工作流管理 |
| `super_admin` | 超级管理员 |

**对用户提示包名时**，必须同时给出两者，格式：`packageName（displayName）`。

只说内部名（如"请开启 operit_editor"），用户在 UI 中找不到对应条目；只说显示名，AI 无法用 `set_sandbox_package_enabled` 操作。