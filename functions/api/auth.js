// 令牌校验端点：中间件已校验 Authorization，通过即返回 ok
// 用途：前端登录时验证令牌是否正确
export async function onRequestPost(context) {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
