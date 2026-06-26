// 鉴权中间件：所有 /api/* 请求须携带正确的访问令牌
// 令牌由环境变量 ACCESS_TOKEN 提供；未配置 ACCESS_TOKEN 时不启用鉴权
export async function onRequest(context) {
  const { request, env } = context;
  const expected = env.ACCESS_TOKEN;

  if (expected) {
    const auth = request.headers.get("Authorization") || "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (provided !== expected) {
      return new Response(
        JSON.stringify({ success: false, error: "未授权，请提供有效的访问令牌" }),
        { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }
  }

  return context.next();
}
