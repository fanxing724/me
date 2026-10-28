# 番星个人主页

基于 IonRh/HomePage 修改，保留原项目 MIT 许可与署名。展示个人介绍、博客和社区主页入口，后台沿用上游内容编辑器。

- 线上主页：https://724520.xyz/
- 后台：https://724520.xyz/manage
- 部署方式：Cloudflare Workers Static Assets + KV，单域名、同源 API。
- 内容存储：MY_HOME_KV 的 portfolio_data。
- 管理凭据：admin_credentials 仅存 PBKDF2-SHA256 加盐哈希；默认密码已移除。
- 后台修改密码要求至少 12 位，并使旧会话失效。
- public/ 是唯一发布的静态目录；本机私密文件、原仓库文件均不对外提供。

修改代码后使用 Wrangler deploy；只改简介、头像和网站链接，可直接在网页后台保存，无需重新部署。

本机交付记录和私密登录文件在 /home/fanxing/codex-workspace/homepage-cloudflare-deployment/ 下，均不在 Git 仓库内。

本地调试：Wrangler dev --local --port 8788。测试数据与线上 KV 独立。
