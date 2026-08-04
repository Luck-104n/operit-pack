"use strict";

/**
 * tool_call_repair — 复刻 Command Code 的 Tool Call Repair（确定性修复层）
 * v0.2.0 合规版
 *
 * 挂载点：ToolPkg registerToolLifecycleHook("tool_call_intercept")
 *
 * 【关键限制（v0.1.0 实测踩坑）】
 *   ToolLifecycleAllowResult = { action: "allow" }
 *   ToolLifecycleBlockResult = { action: "block", reason }
 *   —— hook 只能放行/拦截，没有参数替换通道。
 *   修改 event.eventPayload 会抛 IllegalStateException（平台只读保护），
 *   并导致安装链路中断（debug_install_toolpkg 报 Unknown error、文件未落盘）。
 *
 * 【合规策略】
 *   检测到可确定性判定的参数漂移（package_proxy 的 tool_name 错位/缺失）时：
 *   block + reason 返回 repair_note（精确纠正信息，等价 Command Code 的 repair_note 回传），
 *   模型看到后下一轮按正确格式重新调用，无需额外推理回合。
 *
 * 【原则】
 *   只修复无语义歧义的问题，绝不猜命令/路径/内容。
 *   非 package_proxy 工具 MVP 阶段不拦截（避免误伤正常调用）。
 */

const PLUGIN_ID = "com.operit.tool_call_repair";
const HOOK_ID = "tool_call_repair_lifecycle";

// package_proxy 的 tool_name 常见漂移键名（按可能性排序）
const TOOL_NAME_ALIASES = ["tool_name", "toolName", "toolname", "tool", "name"];
// 通用参数名别名映射：规范名 -> 别名列表（Command Code 风格，备用）
const PARAM_ALIASES = {
  "file_path": ["path", "filePath", "filepath"],
  "command": ["cmd", "cmdline", "shellCommand", "shell_command"],
  "pattern": ["query", "regex", "search", "glob"],
  "old_string": ["oldValue", "old_value", "old"],
  "new_string": ["newValue", "new_value", "replacement", "replace"],
  "package_name": ["packageName", "pkg", "pkgName", "package"],
  "params": ["parameters", "args", "arguments"],
  "timeout_ms": ["timeout", "timeoutMs", "timeoutMilliseconds"],
};
const TRUE_VALUES = new Set(["true", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "no", "off"]);

function log(level, msg) {
  try { console.log("[tool_call_repair] " + level + ": " + msg); } catch (e) {}
}

function tryParseJson(str) {
  if (typeof str !== "string") return null;
  try { return JSON.parse(str); } catch (e) { return null; }
}

function normalizeToolName(name) {
  if (!name || typeof name !== "string") return null;
  const t = name.trim().replace(/^`+|`+$/g, "").trim();
  return t || null;
}

// 从 params 对象内部找 tool_name 候选（模型把 tool_name 塞进 params 的场景）
function extractToolNameFromParams(paramsObj) {
  if (!paramsObj || typeof paramsObj !== "object") return null;
  for (const key of TOOL_NAME_ALIASES) {
    const v = paramsObj[key];
    if (typeof v === "string" && v.trim()) {
      const n = normalizeToolName(v);
      if (n) return { name: n, key: key };
    }
  }
  return null;
}

// 递归类型强转（Command Code 风格；本版仅用于诊断提示，不写回）
function coerceTypes(v) {
  if (typeof v === "string") {
    const t = v.trim();
    const low = t.toLowerCase();
    if (TRUE_VALUES.has(low)) return true;
    if (FALSE_VALUES.has(low)) return false;
    if (t === "null") return null;
    if (t !== "" && t !== "-" && !isNaN(Number(t))) return Number(t);
    return v;
  }
  if (Array.isArray(v)) return v.map(coerceTypes);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v)) out[k] = coerceTypes(v[k]);
    return out;
  }
  return v;
}

/**
 * 诊断 package_proxy 调用，生成 repair_note。
 * 期望形态：parameters = { tool_name: "pkg:tool", params: "<json>" }
 * 注意：本函数是纯诊断，绝不修改任何参数。
 * @returns {{ block: boolean, toolName: ?string, reason: string }}
 */
function diagnosePackageProxy(parameters) {
  const issues = [];
  const params = Object.assign({}, parameters || {});
  let toolName = normalizeToolName(params["tool_name"]);
  let aliasKey = null;
  let innerParamsValue = null; // 从 params 内部提取出的真实 params 值（JSON 字符串原文，用于生成照抄示范）

  // 1) 别名键提取（toolName / tool / name ...）
  if (!toolName) {
    for (const k of TOOL_NAME_ALIASES) {
      if (k === "tool_name") continue;
      const v = normalizeToolName(params[k]);
      if (v) {
        toolName = v;
        aliasKey = k;
        issues.push('tool_name 使用了别名键 "' + k + '"（必须是独立参数 tool_name）');
        break;
      }
    }
  }

  // 2) 从 params JSON 内部提取（模型把 tool_name 塞进 params）
  if (!toolName) {
    const raw = params["params"] !== undefined ? params["params"] : params["parameters"];
    const pObj = tryParseJson(raw);
    if (pObj && typeof pObj === "object") {
      const inner = extractToolNameFromParams(pObj);
      if (inner) {
        toolName = normalizeToolName(inner.name);
        const rest = Object.assign({}, pObj);
        delete rest[inner.key];
        // 重组示范：若剩余字段含 params（真实参数），取它的值（字符串原样/对象 JSON.stringify）；
        // 否则取剩余字段整体 JSON。修复：内层 params 为对象时不再嵌套（params={"params":{}} bug）
        if (typeof rest["params"] !== "undefined") {
          innerParamsValue = typeof rest["params"] === "string" ? rest["params"] : JSON.stringify(rest["params"]);
        } else {
          innerParamsValue = JSON.stringify(rest);
        }
        issues.push('tool_name 被错误地放进了 params JSON 内部（键 "' + inner.key + '"），必须是独立参数 tool_name');
      }
    }
  }

  // 3) 完全缺失且无法推断 -> 必失败，block
  if (!toolName) {
    return {
      block: true,
      toolName: null,
      reason: "[tool_call_repair] package_proxy 缺少 tool_name 且无法确定性推断。正确调用格式：package_proxy(tool_name=\"包名:工具名\", params={...})。要求：① tool_name 必须是独立参数（键名 tool_name），格式 包名:工具名；② 不要用 toolName/tool/name 等别名键；③ 不要把 tool_name 塞进 params JSON 内部；④ params 必须是合法 JSON 字符串。请按此格式重新调用。",
    };
  }

  // 4) 已能确定 tool_name 但位置错误 -> 必失败，block + 精确纠正（含可直接照抄的示范）
  if (aliasKey || issues.length > 0) {
    let reason = "[tool_call_repair] package_proxy 调用参数异常：" + issues.join("；") + "。";
    if (innerParamsValue !== null) {
      // 模型把整个调用并成了单 params 字符串：给出重组后的完整调用，可直接照抄
      reason += '纠正：请直接照抄以下调用重新执行——package_proxy(tool_name="' + toolName + '", params=' +
        innerParamsValue + ')。tool_name 必须是顶层独立参数，params 必须是合法 JSON。';
    } else {
      reason += '纠正：请重新调用 package_proxy(tool_name="' + toolName + '", params={...})，' +
        "tool_name 必须是独立参数（键名 tool_name），params 必须是合法 JSON 字符串。";
    }
    return { block: true, toolName: toolName, reason: reason };
  }

  // 5) tool_name 位置正确，但 params 存在类型漂移 -> 仅提示，不 block（平台可能容错，避免误伤）
  const hints = [];
  if (params["params"] !== undefined && typeof params["params"] !== "string") {
    hints.push("params 应为 JSON 字符串（当前为 " + typeof params["params"] + "），应 JSON.stringify 后再传");
  }
  if (typeof params["params"] === "string") {
    const parsed = tryParseJson(params["params"]);
    if (parsed && typeof parsed === "object") {
      const typeIssues = [];
      for (const k of Object.keys(parsed)) {
        const v = parsed[k];
        if (typeof v === "string") {
          const t = v.trim();
          const low = t.toLowerCase();
          if (TRUE_VALUES.has(low)) {
            typeIssues.push(k + ': "' + t + '" 应为布尔 true');
          } else if (FALSE_VALUES.has(low)) {
            typeIssues.push(k + ': "' + t + '" 应为布尔 false');
          } else if (t !== "" && t !== "-" && !isNaN(Number(t))) {
            typeIssues.push(k + ': "' + t + '" 应为数字 ' + Number(t));
          }
        }
      }
      if (typeIssues.length > 0) hints.push("params 内存在类型漂移：" + typeIssues.join("；"));
    }
  }
  if (hints.length > 0) {
    log("HINT", toolName + ": " + hints.join("; "));
  }

  return { block: false, toolName: toolName, reason: null };
}

function onToolLifecycle(event) {
  const eventName = event && (event.eventName || event.event);
  if (eventName !== "tool_call_intercept") return null;
  const payload = (event && event.eventPayload) || {};
  const toolName = payload.toolName || "";
  const parameters = payload.parameters || {};

  // 仅拦截 package_proxy：tool_name 漂移是本 bug 核心
  if (toolName === "package_proxy") {
    const d = diagnosePackageProxy(parameters);
    if (!d.block) return null; // 正常调用放行，不干预
    // 附加实际收到的参数原文（调试诊断用），让模型直观看到平台侧收到的参数
    let reason = d.reason;
    try {
      const raw = JSON.stringify(parameters);
      const clipped = raw.length > 800 ? raw.substring(0, 800) + "…(参数原文过长已截断)" : raw;
      reason += "\n参数原文: " + clipped;
    } catch (e) {}
    log("BLOCK", d.toolName ? "repair_note for " + d.toolName : "repair_note (unknown tool)");
    return { action: "block", reason: reason };
  }

  // 其他工具：MVP 阶段不拦截（避免误伤），交给正常链路
  return null;
}

function registerToolPkg() {
  if (typeof ToolPkg === "undefined" || !ToolPkg.registerToolLifecycleHook) {
    log("ERROR", "ToolPkg.registerToolLifecycleHook unavailable");
    return false;
  }
  ToolPkg.registerToolLifecycleHook({
    id: HOOK_ID,
    function: onToolLifecycle,
  });
  log("OK", "tool lifecycle hook registered (" + PLUGIN_ID + ")");
  return true;
}

if (typeof exports !== "undefined") {
  exports.registerToolPkg = registerToolPkg;
  exports.onToolLifecycle = onToolLifecycle;
  exports.diagnosePackageProxy = diagnosePackageProxy;
  exports.coerceTypes = coerceTypes;
}
