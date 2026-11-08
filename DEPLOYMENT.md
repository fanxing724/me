# 部署与恢复

先阅读 [架构设计](docs/architecture.md)。以下采用仓库中的站点名；部署到其他账号时，需要统一替换配置、源码中的域名、CORS 白名单与服务绑定名称。

## 1. 环境与配置

使用 Node.js 24+、Python 3、curl 和 Wrangler。`npm test` 无需安装 npm 依赖；Wrangler 可通过 `npx wrangler` 调用。以下示例假设 `wrangler` 命令可用。

复制配置模板，实际文件已在 `.gitignore` 中排除：

```sh
cp wrangler.jsonc wrangler.deploy.jsonc
cp wrangler.backend.jsonc wrangler.backend.deploy.jsonc
cp wrangler.gateway.jsonc wrangler.gateway.deploy.jsonc
cp wrangler.entry.jsonc wrangler.entry.deploy.jsonc
```

在实际配置中填写自己的 Cloudflare account_id，后台的 MY_HOME_KV ID，所有自定义域名和服务名。KV 绑定模板中的全零 ID 是占位符。所有模板默认 `workers_dev: false`、`preview_urls: false`，只保留自定义域名，避免发布时重新开放备用和预览入口。

域名入口：

| 地址 | 绑定 |
|---|---|
| `admin.724520.xyz` | `fanxing-homepage-admin` |
| `cf.724520.xyz` | `fanxing-homepage` |
| `cdn.724520.xyz` | `fanxing-homepage-cdn` |
| `724520.xyz` | `fanxing-homepage-entry` |
| `eo.724520.xyz` | EdgeOne 提供的 CNAME，Cloudflare DNS 中使用仅 DNS |

## 2. 存储与首次初始化

后台沿用 `MY_HOME_KV`，包含 `portfolio_data`、`admin_credentials`、`secret_key`。新账号可创建一个 KV 命名空间，填写其 ID。

只对全新部署初始化，已有站点不要重新写入凭据或公开快照：

```sh
python3 tools/init-admin.py
wrangler kv key put admin_credentials --binding MY_HOME_KV --config wrangler.backend.deploy.jsonc --path private/admin-credentials.json --remote
wrangler kv key put secret_key --binding MY_HOME_KV --config wrangler.backend.deploy.jsonc --path private/session-key.txt --remote
wrangler kv key put portfolio_data --binding MY_HOME_KV --config wrangler.backend.deploy.jsonc --path data/site-content.json --remote
```

初始化脚本在终端隐藏输入密码，生成权限 0600 的本地文件，不输出密码或密钥。账户名自行填写，密码至少 12 位。PBKDF2-SHA256 使用 100000 次迭代；不要使用上游历史默认账号。

两种 Durable Object：

- `PageViewCounter` 托管在 CF 主页 Worker，迁移 `pageviews-v1`，实例名 `homepage`。后台通过 `script_name` 引用同一命名空间，避免重新计数。
- `HomepageSettings` 托管在后台 Worker，迁移 `homepage-settings-v1`，实例名 `homepage-settings`。首次未保存时使用代码默认值；保存后原子维护配置版本和最近 12 版历史。

## 3. 新账号的发布顺序

服务绑定与原计数 DO 形成启动依赖。**首次创建** CF 主页时，先准备一份临时配置，移除 `services` 和 `routes`，设置 `workers_dev: false`，部署原主页 Worker 与 PageViewCounter。此阶段不对外开放，公开接口暂不可用。不要删除 DO 的类导出和迁移。

随后构建并发布后台，再恢复完整 CF 配置发布主页：

```sh
python3 tools/build-backend.py
wrangler deploy --config wrangler.backend.deploy.jsonc
wrangler deploy --config wrangler.deploy.jsonc
```

已有部署无需执行临时启动步骤，保留现有命名空间直接更新即可。

后台地址 `/` 会转到 `/manage`。原 CF `/manage` 仅导航到独立后台，不再承载管理写入。

## 4. EdgeOne 国际版

```sh
python3 tools/package-edgeone.py --output homepage-edgeone.zip
```

在 EdgeOne Pages/Makers 直接上传 ZIP，绑定 `eo.724520.xyz`。ZIP 首层必须包含 `index.html`、`edge-functions/`、`edgeone.json`，不能再多包一层目录。

无需 KV、登录凭据、环境变量或构建命令。公开 API 由 Edge 函数固定读取独立后台；上游失败时返回包内公开快照，浏览器会尝试只读后台公开接口。正式 EO 域名由浏览器直接 POST 后台公开计数接口；平台预览域名只读总数。账号和 Cookie 不进入包。

日常改配置只需后台保存；修改前端代码、图片或其他静态文件才需要再次打包上传。

可选：发布前运行 `python3 tools/refresh-homepage-snapshot.py`，只读取两个公开后台接口，不写线上数据。失败时不要发布半更新快照；检查网络后重试。

## 5. 测速页与根域

确认 EO、CF 的 `/cdn-check` 都返回正确 JSON，并允许 `https://cdn.724520.xyz` 的 CORS 后：

```sh
node gateway/build.mjs
wrangler deploy --config wrangler.gateway.deploy.jsonc
```

先访问 `https://cdn.724520.xyz/?manual=1`，检查头像、背景、两条线路和手动进入，再验证自动选线。网关图片由 GATEWAY_ASSETS 提供；头像内嵌，字体和页面样式沿用上游。

最后部署入口：

```sh
wrangler deploy --config wrangler.entry.deploy.jsonc
```

主域名首页使用 302/no-store 到测速页，保留 query/hash；`/manage` 导航到独立后台。前台资源和 API 路径不返回测速 HTML。不要把 CF 主页再跳回根域，否则会循环。

## 6. 验证与回退

检查后台登录/退出、匿名和跨站写入拒绝、设置冲突返回 409、公开内容一致、静态资源、音乐和小票、手机布局，以及根域完整跳转。正式访问量测试优先 GET；浏览器 QA 应拦截计数 POST，避免污染总数。

- 配置回退：从设置历史载入草稿，核对后保存为新版本。
- 内容回退：先导出当前完整备份，再导入目标备份到编辑区，核对后保存。
- 代码回退：使用前一 Worker 版本或源码重新发布；保留 KV、两类 DO 的绑定、类导出和迁移历史。
- 入口回退：单独修改/解除新入口 Worker 的域名绑定，不影响独立后台；可直接用 CF/EO 子域名访问主页。

不要删除原主页 Worker 来“清理多余 Worker”：它仍托管历史计数器。若确实要移除，先按 Cloudflare 官方流程做 DO 迁移。
