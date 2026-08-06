"use strict";
const path = "/sdcard/Download/Operit/dev_package/tool_call_repair/dist/main.js";
const m = require(path);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? " :: " + extra : "")); }
}

// S1 正常调用 -> 放行
let d = m.diagnosePackageProxy({ tool_name: "time:get_time", params: "{}" });
check("S1 normal ok", d.block === false, JSON.stringify(d));

// S2 缺少 tool_name -> block + 格式要求
d = m.diagnosePackageProxy({ params: "{}" });
check("S2 missing -> block", d.block === true && d.toolName === null && d.reason.indexOf("tool_name") >= 0);

// S3 别名键 toolName -> block + 精确纠正
d = m.diagnosePackageProxy({ toolName: "time:get_time", params: "{}" });
check("S3 alias key -> block+correct", d.block === true && d.toolName === "time:get_time" && d.reason.indexOf('tool_name="time:get_time"') >= 0, d.reason);

// S4 tool_name 在 params JSON 内部 -> block + 照抄示范
d = m.diagnosePackageProxy({ params: '{"tool_name":"time:get_time"}' });
check("S4 inside params -> block", d.block === true && d.toolName === "time:get_time" && d.reason.indexOf("params JSON") >= 0 && d.reason.indexOf('package_proxy(tool_name="time:get_time", params={})') >= 0, d.reason);

// S13 真实退化场景：整个调用被并成单 params 字符串 -> block + 重组示范
d = m.diagnosePackageProxy({ params: '{"tool_name":"time:get_time","params":"{}"}' });
check("S13 nested merge -> block+copy", d.block === true && d.toolName === "time:get_time" && d.reason.indexOf('package_proxy(tool_name="time:get_time", params={})') >= 0 && d.reason.indexOf("直接照抄") >= 0, d.reason);

// S14 那边复现的嵌套 bug：内层 params 是对象 {}（非字符串）-> 示范不得再嵌套 params={"params":{}}
d = m.diagnosePackageProxy({ params: '{"tool_name":"time:get_time","params":{}}' });
check("S14 obj inner no-nest", d.block === true && d.reason.indexOf('package_proxy(tool_name="time:get_time", params={})') >= 0 && d.reason.indexOf('params={"params":{}}') < 0, d.reason);

// S5 params 类型漂移（limit:"1"）-> 不 block（避免误伤）
d = m.diagnosePackageProxy({ tool_name: "extended_chat:list_chats", params: '{"limit":"1"}' });
check("S5 type drift no-block", d.block === false, JSON.stringify(d));

// S6 onToolLifecycle 非 package_proxy -> null
let r = m.onToolLifecycle({ eventName: "tool_call_intercept", eventPayload: { toolName: "time:get_time", parameters: {} } });
check("S6 non-proxy null", r === null, String(r));

// S7 package_proxy 正常调用 -> null（放行不干预）
r = m.onToolLifecycle({ eventName: "tool_call_intercept", eventPayload: { toolName: "package_proxy", parameters: { tool_name: "time:get_time", params: "{}" } } });
check("S7 normal allow", r === null, String(r));

// S8 package_proxy 缺 tool_name -> block result（repair_note + 参数原文）
r = m.onToolLifecycle({ eventName: "tool_call_intercept", eventPayload: { toolName: "package_proxy", parameters: { params: "{}" } } });
check("S8 proxy missing -> block", r !== null && r.action === "block" && typeof r.reason === "string" && r.reason.length > 10, JSON.stringify(r));
check("S8b reason has raw params", r !== null && r.reason.indexOf("参数原文: ") >= 0 && r.reason.indexOf('"params":"{}"') >= 0, r && r.reason);

// S12 别名键场景 -> reason 含参数原文 JSON（对面 AI 可见实际收到什么）
r = m.onToolLifecycle({ eventName: "tool_call_intercept", eventPayload: { toolName: "package_proxy", parameters: { toolName: "time:get_time", params: "{}" } } });
check("S12 alias reason has raw", r !== null && r.action === "block" && r.reason.indexOf('"toolName":"time:get_time"') >= 0, r && r.reason);

// S9 无 eventPayload -> 安全不抛异常
r = m.onToolLifecycle({ eventName: "tool_call_intercept" });
check("S9 no payload safe", r === null, String(r));

// S10 事件名不匹配 -> null
r = m.onToolLifecycle({ eventName: "tool_execution_started", eventPayload: {} });
check("S10 wrong event null", r === null);

// S11 关键回归：v0.1.0 的 writeBack 行为已彻底移除（无 eventPayload 写入）
const src = require("fs").readFileSync(path, "utf8");
check("S11 no eventPayload mutation", src.indexOf("eventPayload.parameters =") < 0 && src.indexOf("writeBack") < 0);

// ---- v0.3.0 治本层测试 ----

// S15 patchPackageProxyToolItem 改写 package_proxy 工具定义
let itm = { categoryName: "x", name: "package_proxy", description: "代理调用工具", parameters: "tool_name" };
let p15 = m.patchPackageProxyToolItem(itm);
check("S15 proxy item patched", p15 !== itm && p15.description.indexOf("[参数规范]") >= 0 && Array.isArray(p15.parametersStructured) && p15.parametersStructured.length === 2, JSON.stringify(p15));

// S16 非 package_proxy 工具不动（返回同一引用）
let other = { categoryName: "x", name: "time:get_time", description: "时间" };
check("S16 other item unchanged", m.patchPackageProxyToolItem(other) === other);

// S17 onToolPromptCompose 非 filter_tool_prompt_items -> null
let r17 = m.onToolPromptCompose({ eventName: "before_compose_tool_prompt", eventPayload: {} });
check("S17 wrong stage null", r17 === null, String(r17));

// S18 onToolPromptCompose 无 availableTools -> null
r17 = m.onToolPromptCompose({ eventName: "filter_tool_prompt_items", eventPayload: {} });
check("S18 no tools null", r17 === null, String(r17));

// S19 onToolPromptCompose 含 package_proxy -> 返回改写后的 availableTools（其他工具原样）
let toolsArr = [{ categoryName: "x", name: "package_proxy", description: "代理" }, { categoryName: "x", name: "other_tool", description: "其他" }];
let r19 = m.onToolPromptCompose({ eventName: "filter_tool_prompt_items", eventPayload: { availableTools: toolsArr } });
check("S19 proxy tool patched in list", r19 !== null && Array.isArray(r19.availableTools) && r19.availableTools.length === 2 && r19.availableTools[0].description.indexOf("[参数规范]") >= 0 && r19.availableTools[1] === toolsArr[1], JSON.stringify(r19));

// S20 onSystemPromptCompose 注入调用规则
let r20 = m.onSystemPromptCompose({ eventName: "after_compose_system_prompt", eventPayload: { systemPrompt: "SYSTEM" } });
check("S20 sys prompt injected", r20 !== null && typeof r20.systemPrompt === "string" && r20.systemPrompt.indexOf("[工具调用修复规则]") >= 0, JSON.stringify(r20));

// S21 onSystemPromptCompose 已含规则不重复注入
let r21 = m.onSystemPromptCompose({ eventName: "after_compose_system_prompt", eventPayload: { systemPrompt: "SYSTEM[工具调用修复规则]" } });
check("S21 no dup inject", r21 === null, String(r21));

console.log("=== " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
