# see-u-say

基于 FLUX.2 klein 4B 的文生图应用，部署在 Cloudflare Pages。

## 功能

- 基于 `@cf/black-forest-labs/flux-2-klein-4b` 的文生图
- 最多 4 张参考图上传（自动缩放至 ≤512×512，保持原宽高比）
- 自定义输出尺寸（256–1920，须为 64 的倍数）
- 亮色 / 暗色 / 跟随系统三种主题
- 简单令牌鉴权，需输入访问令牌才能进入
- 可选的提示词优化（OpenAI 兼容文本模型，冗余兼容 DeepSeek `thinking` 与硅基流动 `enable_thinking`）

## 部署（Cloudflare Pages）

1. 在 Cloudflare Pages 连接本仓库
2. 构建命令留空（纯静态站点 + Pages Functions，无需构建）
3. 输出目录为根目录（`/`）
4. 在 Pages 项目 **设置 → 环境变量** 中配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `CF_ACCOUNT_ID` | 是 | Cloudflare 账户 ID |
| `CF_API_TOKEN` | 是 | 有 Workers AI 权限的 API Token |
| `ACCESS_TOKEN` | 否 | 访问令牌，配置后需在登录页输入该令牌才能使用 |
| `TEXT_MODEL_PROVIDERS` | 否 | JSON 字符串，文本模型提供商列表；开启提示词优化时必填 |

### TEXT_MODEL_PROVIDERS 示例

```json
[
  {
    "name": "DeepSeek",
    "base_url": "https://api.deepseek.com",
    "api_key": "sk-xxx",
    "models": ["deepseek-v4-flash", "deepseek-v4-pro"]
  },
  {
    "name": "SiliconFlow",
    "base_url": "https://api.siliconflow.cn/v1",
    "api_key": "sk-yyy",
    "models": ["Qwen/Qwen3-8B", "deepseek-ai/DeepSeek-V4-Flash"]
  }
]
```

> 注意：`api_key` 仅存在服务端环境变量中，前端通过 `/api/providers` 仅能拿到 `name` 与 `models`，密钥不会泄露。

## 架构

- 前端：原生 HTML/CSS/JS（`index.html` + `assets/`）
- 后端：Cloudflare Pages Functions（`functions/api/`），代理图片模型与文本模型调用，隐藏密钥
  - `POST /api/auth` — 令牌校验
  - `POST /api/generate` — 代理调用 flux-2-klein-4b
  - `POST /api/optimize` — 代理调用文本模型优化提示词
  - `GET /api/providers` — 返回脱敏的提供商列表

## 本地开发

可用 Wrangler 本地预览：

```bash
npx wrangler pages dev . --binding CF_ACCOUNT_ID=xxx --binding CF_API_TOKEN=xxx --binding ACCESS_TOKEN=xxx
```
