// 代理调用 CF Workers AI 图片模型，隐藏 API Token
// 转发 multipart/form-data 到 flux-2-klein-4b，返回 base64 图片
export async function onRequestPost(context) {
  const { request, env } = context;

  const accountId = env.CF_ACCOUNT_ID;
  const apiToken = env.CF_API_TOKEN;
  if (!accountId || !apiToken) {
    return json({ success: false, error: "服务端未配置 CF_ACCOUNT_ID / CF_API_TOKEN" }, 500);
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`;

  try {
    // 直接转发原始 multipart body（保留 boundary），仅附加鉴权头
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": request.headers.get("Content-Type") || "multipart/form-data",
      },
      body: request.body,
    });

    const data = await resp.json();

    // flux-2 输出 schema: { "image": "<base64>" }
    if (data && data.image) {
      return json({ success: true, image: data.image });
    }
    // 兼容 legacy { success, result:{image}, errors }
    if (data && data.success && data.result && data.result.image) {
      return json({ success: true, image: data.result.image });
    }

    // 错误处理
    const errors = (data && data.errors) || [];
    const errObj = errors[0] || {};
    const flagged = errObj.code === 3030 || /flagged/i.test(errObj.message || "");
    return json({
      success: false,
      error: errObj.message || `图片生成失败 (HTTP ${resp.status})`,
      flagged,
    }, resp.ok ? 200 : 400);
  } catch (err) {
    return json({ success: false, error: "请求 Cloudflare 失败：" + (err.message || err) }, 502);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
