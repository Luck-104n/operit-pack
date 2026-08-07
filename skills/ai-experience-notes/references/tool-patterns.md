# Tool Patterns — 工具调用模式

<!-- 演进: 2026-07-02 | 来源: evolution 插件修复 | 类型: pattern -->

### 文件写入时的转义层级问题（Shell→Python→JS 三层转义）

## 问题描述

通过 `super_admin:terminal` 向文件写入含特殊字符的内容时，转义层级嵌套容易出错。

## 转义层级

```
Shell heredoc  →  Python 代码  →  生成的 JS/JSON 文件
     |               |                |
 单引号定界符      字符串字面量      最终目标格式
```

## 各层规则

### Shell heredoc（`<< 'XEOF'`）
- 单引号定界符：**完全禁止变量展开**，内容按原样传递
- `$`、反引号保持字面，不会解释
- `\n` 保持为文字 `\n`（两个字符），不会变成换行

### Python 字符串
- `'\\n'` → 实际值 `\n`（反斜杠+n），对应 JS 中的 `split("\\n")`
- `'\n'` → 实际值 换行符（0x0A）
- `chr(10)` → 换行符 ✅ 最安全的方式，无转义歧义

### 最终文件（JS/JSON）
- `"\n"` → JS 中的换行转义 ✅
- `"\\n"` → JS 中的文字 `\n` ✅
- 真实换行符（0x0A）在 JS 字符串中 = 语法错误 ❌

## 最佳实践

### 方案 A：`create_file`（推荐）
用平台自带的 `create_file` 工具直接写文件，**完全避免转义问题**。
```
create_file(path="/sdcard/.../xxx.js", new="...文件内容...")
```

### 方案 B：Python 写文件
```python
with open(path, 'w') as f:
    f.write(content)
```
用 `chr(10)` 代替 `\n` 做拼接，避免歧义。

### 方案 C：Base64 传递
对复杂内容先 base64 编码再传给 terminal 解码。

## 关键教训

1. **Python `repr()` 的输出不能区分真实换行和文字 `\n`**——两个都显示为 `\n`。要检查真实字节用 `[hex(b) for b in data[:50]]`。
2. **Sandbox Package 的 METADATA 格式有特定要求**：`/*`、`METADATA`、`{` 最好各占一行，`{` 必须在新行。
3. **JS 字符串中不能有原始换行符**——必须用 `\n` 转义或者用变量 `var NL = "\n";` 拼接。
4. **Heredoc 里的 `\\n` 不等于 Python 的 `\n`**——前者在 Python 中是文字反斜杠+n，后者才是换行符。
5. **`debug_install_toolpkg` 仍然有 Unknown error bug**（未修复），`debug_install_js_package` 则正常工作。

## 快速自查清单

- [ ] 目标文件需要什么格式的换行？
- [ ] 当前用了哪种写入方式？（create_file / Python / heredoc）
- [ ] 特殊字符（`\n`、`\t`、反引号、`$`）当前在哪一层？
- [ ] 最终目标（JS引擎/Python/Shell）能否接受当前的字符形式？

---

<!-- 演进: 2026-07-11 | 来源: 悬浮窗翻译APP开发总结重构 | 类型: pattern -->

### javap 反编译检查 jar 包 API

**场景**：升级第三方库后，旧代码的 API 调用报错，不确定新版本的方法签名。

**用法**：
```bash
# 1. 找到 jar 包（从 gradle 缓存或 libs/ 目录）
# 2. 解压并反编译
cd /tmp
unzip -qo /path/to/library-version.jar -d lib-out/
javap -public -cp lib-out/classes.jar com.example.SomeClass
```

**优点**：无需文档，直接看到实际可用的 public 方法和参数类型。

---

<!-- 演进: 2026-07-11 | 来源: 悬浮窗翻译APP开发总结重构 | 类型: pattern -->

### Android 文件操作模式（Shizuku 不可用时）

在 Shizuku 服务不可用的情况下，通过工具组合完成文件操作：

| 操作 | 工具 | 说明 |
|------|------|------|
| 创建文件 | `create_file` / `edit_file`（走平台工具层） | 首选，零转义问题 |
| 写入复杂内容 | `code_runner:run_python` 配合 `open(path, 'w')` | 绕过 shell 转义 |
| 查找文件 | `find_files`（跨目录搜索） | 或 terminal `find` 命令 |
| 读取长文件 | `read_file_part` 按行读取 | 比一次性 read_file 更适合大文件 |
| 移动/复制 | `extended_file_tools:move_file` / `copy_file` | Shizuku 可用时 |

---

<!-- 演进: 2026-08-07 | 来源: 文件覆写机制实证调查 | 类型: pattern -->

### 平台文件对象备份/回朔机制（.backup/）

**核心发现**：Operit 平台对工作区文件操作提供**内容寻址的对象备份**，文件被删除/覆写后**可回朔**，并非"删除即丢失"。

| 位置 | 作用 |
|------|------|
| `.backup/objects/<哈希前2位>/<完整SHA-256>` | **文件内容对象库**：每次写操作的内容快照，按内容哈希寻址，同名文件每个历史版本独立存放 |
| `.backup/chats/<chatId>/current_state.json` | 当前工作区文件清单（`files` 字段：文件路径 → 内容哈希引用） |
| `.backup/chats/<chatId>/<timestamp>.json` | 历史状态快照（每次变更的时间点记录） |
| `.operit/config.json` | 工作区配置 |

**验证方法**：`current_state.json` 中 `files` 的值（如 `f9c9498e...`）会出现在 `.backup/objects/f9/f9c9498e...`，读取该对象即可拿到文件历史内容。

**对文件覆写判断的影响**：
- 平台强制 `delete→write` 覆写**是安全设计**，因为有对象备份兜底，两步链中断时旧内容仍可从对象库恢复；
- 因此"两步链有丢失窗口、会永久丢数据"的表述**不准确**——平台有回朔机制。但**跨会话/清理备份目录后**才可能真正丢失，仍需谨慎。