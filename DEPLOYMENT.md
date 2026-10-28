# Cloudflare 部署与恢复

主页：https://724520.xyz/
后台：https://724520.xyz/manage

## 源码与内容

- `worker.mjs`：Worker 与鉴权、KV 数据接口。
- `public/`：前台与后台静态资源。
- `admin/index.html`、`admin/login.html`：后台和登录页源码。
- `admin/pages.mjs`：运行 `python3 tools/build-admin.py` 生成。
- `data/site-content.json`：公开站点内容快照，不含账号凭据。

## 部署

1. 将 `wrangler.jsonc` 复制为 `wrangler.deploy.jsonc`（已被 Git 忽略）。
2. 配置自己的 Cloudflare account_id、MY_HOME_KV 绑定与自定义域名。
3. 运行 `python3 tools/build-admin.py`。
4. 使用 Wrangler 对 `portfolio_data` 写入内容快照；管理员凭据需要另行初始化，不能使用上游默认密码。
5. 运行 `wrangler deploy --config wrangler.deploy.jsonc`。

管理员凭据格式为 `{username,salt,hash}`，hash 使用 PBKDF2-SHA256、100000 次迭代、32 字节结果；密码与 salt 均按 UTF-8 编码，salt 和 hash 字段为十六进制文本。登录后可在账号安全页修改用户名与密码。

后台保存内容无需重新部署。可通过数据备份页面导出/导入 JSON；先备份再恢复，避免覆盖更新的资料。

当前机器上的部署记录、回退备份及登录文件在 `/home/fanxing/codex-workspace/homepage-cloudflare-deployment/`，不纳入源码备份。旧 Worker 版本可通过 Wrangler 的版本回滚功能恢复；内容需单独从备份恢复。

## 验证

本地验证覆盖鉴权、KV 写入与读回、匿名写入拒绝、保存失败状态、网站管理、备份与移动端布局；线上验证记录见本机交付目录。
