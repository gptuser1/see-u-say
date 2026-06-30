// 代理调用 OpenAI 兼容文本模型，用于提示词优化
// 冗余传入 thinking（DeepSeek）与 enable_thinking（硅基流动）两套字段
export async function onRequestPost(context) {
  const { request, env } = context;

  const raw = env.TEXT_MODEL_PROVIDERS;
  if (!raw) {
    return json({ success: false, error: "未配置 TEXT_MODEL_PROVIDERS，无法使用提示词优化" }, 500);
  }

  let providers;
  try {
    providers = JSON.parse(raw);
  } catch (e) {
    return json({ success: false, error: "TEXT_MODEL_PROVIDERS 格式错误" }, 500);
  }
  if (!Array.isArray(providers) || !providers.length) {
    return json({ success: false, error: "TEXT_MODEL_PROVIDERS 为空" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ success: false, error: "请求体解析失败" }, 400);
  }

  const provider = providers[body.providerIndex || 0];
  if (!provider || !provider.base_url || !provider.api_key) {
    return json({ success: false, error: "提供商配置不完整" }, 400);
  }
  const model = body.model;
  if (!model) {
    return json({ success: false, error: "未选择模型" }, 400);
  }

  const thinkingEnabled = !!body.thinkingEnabled;
  const messages = [];
  if (body.systemPrompt && body.systemPrompt.trim()) {
    messages.push({ role: "system", content: body.systemPrompt });
  }
  messages.push({ role: "user", content: body.userPrompt || "" });

  // 冗余传入两套思考字段：DeepSeek 用 thinking，硅基流动用 enable_thinking
  // 各 API 只识别自己支持的字段，多余字段会被忽略
  const payload = {
    model,
    messages,
    temperature: clampNum(body.temperature, 0, 2, 0.5),
    top_p: clampNum(body.topP, 0, 1, 0.9),
    max_tokens: Math.max(1, parseInt(body.maxTokens, 10) || 2048),
    stream: false,
    thinking: { type: thinkingEnabled ? "enabled" : "disabled" },
    enable_thinking: thinkingEnabled,
  };

  const baseUrl = provider.base_url.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const THINKING_KEYWORDS = [
    "does not support parameter",
    "not support",
    "enable_thinking",
    "thinking",
  ];

  const shouldStripThinking = (data) => {
    const str = JSON.stringify(data).toLowerCase();
    return THINKING_KEYWORDS.some((kw) => str.includes(kw.toLowerCase()));
  };

  const doFetch = async (pl) => {
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pl),
    });
  };

  const requestWithRetry = async () => {
    let resp = await doFetch(payload);
    let data = await resp.json();

    if (!resp.ok && shouldStripThinking(data)) {
      const { thinking, enable_thinking, ...restPayload } = payload;
      resp = await doFetch(restPayload);
      data = await resp.json();
    }

    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || `文本模型请求失败 (HTTP ${resp.status})`;
      return json({ success: false, error: msg }, 400);
    }

    const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return json({ success: true, optimizedPrompt: content.trim() });
  };

  try {
    return await requestWithRetry();
  } catch (err) {
    return json({ success: false, error: "请求文本模型失败：" + (err.message || err) }, 502);
  }
}

function clampNum(v, min, max, dft) {
  const n = parseFloat(v);
  if (isNaN(n)) return dft;
  return Math.min(max, Math.max(min, n));
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
