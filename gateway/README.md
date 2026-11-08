# 番星 CDN 入口

页面直接使用 cmliu/Blog-CDN-Gateway：
https://github.com/cmliu/Blog-CDN-Gateway

上游源码原样保存在 vendor/Blog-CDN-Gateway.mjs，MIT 许可在 vendor/LICENSE。样式与上游完全一致；未采用另行设计的页面。番星头像由 build.mjs 从 public/assets/avatar-fast.webp 内嵌，减少额外资源请求。

worker.mjs 读取独立后台的线路设置，设置站名、标题和头像；只对原页面脚本做接入适配：探测 /cdn-check、校验 JSON、禁用自动跳转的手动模式、键盘/点击进入、query/hash 保留。保留上游字体与背景样式。默认等待 999ms 后跳转，与原项目一致。

构建：node gateway/build.mjs
部署：wrangler deploy --config wrangler.gateway.deploy.jsonc

站名、标题、检测提示和线路名称仍可在后台修改。当前站名为“番星 · 个人主页”，标题为“选一条顺畅的路”。

用户背景图以 WebP 存于 gateway/public/assets/cdn-background-v1.webp，原尺寸保留，约 272 KB，通过独立 GATEWAY_ASSETS 绑定提供；后台与主页数据不变。上传者提供的背景不沿用上游项目的 MIT 授权。
