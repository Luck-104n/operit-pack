# Skill 模板

当需要创建一个新的 Operit Skill 时，使用此模板。

## 目录结构

```
/sdcard/Download/Operit/skills/<skill_name>/
├── SKILL.md              # 必需：技能主文件
├── description.json      # 可选：元数据
├── hooks/                # 可选：自动触发脚本
│   └── *.sh
├── references/           # 可选：参考文档
│   └── *.md
└── templates/            # 可选：子模板
    └── *.md
```

## SKILL.md 模板

```markdown
---
name: <skill_name>
description: |
  技能描述。包含触发关键词，每行一个关键词。
  keyword1, keyword2
  中文关键词1, 中文关键词2
---

# 技能标题

## 快速导航

| 主题 | 说明 |
|------|------|
| [使用方法](#使用方法) | 如何调用这个技能 |
| [参数说明](#参数说明) | 可用的参数和选项 |
| [注意事项](#注意事项) | 已知限制 |

## 使用方法

详细描述该技能的用途、触发方式、可用工具。

## 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| param1 | string | 是 | — | 参数说明 |
| param2 | number | 否 | 10 | 参数说明 |

## 步骤

### 步骤1：...

1. 执行操作
2. 检查结果

### 步骤2：...

1. 执行操作
2. 检查结果

## 注意事项

- 已知限制
- 需要用户确认的事项
- 可能失败的原因

## 验证

执行完成后，检查：
- [ ] 检查项1
- [ ] 检查项2
```

## description.json 模板

```json
{
  "name": "skill_name",
  "version": "1.0.0",
  "author": "AI Assistant",
  "description": "技能描述",
  "keywords": ["keyword1", "keyword2"],
  "dependencies": []
}
```

## 验证清单

- [ ] 目录位于 `/sdcard/Download/Operit/skills/<skill_name>/`
- [ ] 包含 `SKILL.md`
- [ ] frontmatter 有 `name` 和 `description`
- [ ] description 包含触发关键词
- [ ] 不与其他 Skill/MCP/Package 重名