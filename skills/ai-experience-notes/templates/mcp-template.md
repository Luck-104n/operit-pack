# MCP 插件模板

当需要创建一个新的 Operit MCP 插件时，使用此模板。

## 目录结构

```
/sdcard/Download/Operit/mcp_plugins/<plugin_id>/
├── mcp_config.json       # 必需：MCP 配置
├── index.js              # Node.js 入口（或 main.py）
├── package.json          # Node.js 依赖（可选）
└── requirements.txt      # Python 依赖（可选）
```

## mcp_config.json 模板

```json
{
  "mcpServers": {
    "plugin_id": {
      "command": "node",
      "args": ["index.js"],
      "env": {
        "API_KEY": ""
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### 配置要点

- `command`：`node`（需要 `pnpm`）、`python3` 或 `bash`
- `args`：使用**相对路径**（相对于 `~/mcp_plugins/<plugin_id>/`）
- `env`：环境变量放在这里，不要用 `read_environment_variable`
- 不要写 Android 侧绝对路径（如 `/sdcard/...`）

## Node.js 入口模板

```javascript
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;
    
    // 处理请求
    const result = handleMethod(method, params);
    
    const response = JSON.stringify({ id, result });
    console.log(response);
  } catch (e) {
    console.error('Error:', e.message);
  }
});

function handleMethod(method, params) {
  switch (method) {
    case 'list_tools':
      return { tools: [] };
    case 'call_tool':
      return { content: [{ type: 'text', text: 'OK' }] };
    default:
      return {};
  }
}
```

## Python 入口模板

```python
import sys
import json

def handle_method(method, params):
    if method == "list_tools":
        return {"tools": []}
    elif method == "call_tool":
        return {"content": [{"type": "text", "text": "OK"}]}
    return {}

for line in sys.stdin:
    try:
        request = json.loads(line.strip())
        result = handle_method(request.get("method"), request.get("params", {}))
        response = {"id": request["id"], "result": result}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"Error: {e}\n")
```

## 验证清单

- [ ] 目录位于 `/sdcard/Download/Operit/mcp_plugins/<plugin_id>/`
- [ ] 包含 `mcp_config.json`
- [ ] `<plugin_id>` 只含 `a-zA-Z_` 和空格
- [ ] command 能在 Linux 终端环境执行
- [ ] args 是相对路径（相对于 `~/mcp_plugins/<plugin_id>/`）
- [ ] 没有使用 Android 绝对路径
- [ ] 调用 `restart_mcp_with_logs` 验证加载