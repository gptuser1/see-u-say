// 鉴权中间件：所有 /api/* 请求须携带正确的访问令牌
// 令牌读取顺序：query 参数 token → multipart 字段 token → JSON body 字段 token
// 令牌由环境变量 ACCESS_TOKEN 提供；未配置 ACCESS_TOKEN 时不启用鉴权
export async function onRequest(context) {
  const { request, env } = context;
  const expected = env.ACCESS_TOKEN;

  if (!expected) {
    return context.next();
  }

  let provided = "";

  // 1. 先从 query 参数取（GET 请求及简单场景）
  const url = new URL(request.url);
  provided = url.searchParams.get("token") || "";

  // 2. POST 请求尝试从 body 取 token 字段
  if (!provided && request.method === "POST") {
    const ct = request.headers.get("Content-Type") || "";

    try {
      if (ct.includes("application/json")) {
        // JSON body：克隆读取后需重建 request
        const cloned = request.clone();
        const body = await cloned.json();
        provided = (body && body.token) || "";
      } else if (ct.includes("multipart/form-data")) {
        // multipart：克隆后解析 form，取出 token 字段
        const cloned = request.clone();
        const form = await cloned.formData();
        provided = form.get("token") || "";
      }
    } catch (e) {
      // 解析失败保持空，后续按无令牌处理
    }
  }

  if (provided !== expected) {
    return new Response(
      JSON.stringify({ success: false, error: "访问令牌无效或缺失" }),
      { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  return context.next();
}
