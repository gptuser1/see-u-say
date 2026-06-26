// 返回文本模型提供商列表（脱敏，不含 api_key），供前端下拉选择
export async function onRequestGet(context) {
  const { env } = context;
  const raw = env.TEXT_MODEL_PROVIDERS;

  if (!raw) {
    return json([], 200);
  }

  let providers;
  try {
    providers = JSON.parse(raw);
  } catch (e) {
    return json({ error: "TEXT_MODEL_PROVIDERS 格式错误" }, 500);
  }

  if (!Array.isArray(providers)) {
    return json({ error: "TEXT_MODEL_PROVIDERS 非数组" }, 500);
  }

  // 脱敏：只返回 name 与 models，不泄露 base_url / api_key
  const safe = providers.map(function (p) {
    return { name: p.name || "未命名", models: Array.isArray(p.models) ? p.models : [] };
  });

  return json(safe, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
