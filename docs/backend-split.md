# 独立后台

当前结构、绑定和 API 以 [完整设计](architecture.md) 与 [部署指南](../DEPLOYMENT.md) 为准。

后台是独立的 `fanxing-homepage-admin` Worker，域名 `admin.724520.xyz`。原账号、内容和签名密钥仍在原 KV，未复制为两份。新自定义设置使用后台专属 `HomepageSettings` SQLite Durable Object，并提供原子版本检查和历史恢复。

CF 主页无 KV 绑定，通过 `HOME_BACKEND` Service Binding 读取公开内容。EO Pages 读取固定后台地址；回源失败时浏览器只读回退到后台，再失败则保留公开快照。两者不转发管理员 Cookie，不承载内容或密码写入。

原访问量仍由 `fanxing-homepage` 的 `PageViewCounter` 托管，后台通过跨 Worker 的 `script_name` 绑定访问同一个实例。不能因后台已独立就删除原 Worker 的 DO 导出、绑定或迁移。

根域由独立入口 Worker 跳转到 CDN 选线页。入口变化不影响后台数据，`fast` 实验入口已不再使用。
