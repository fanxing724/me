# 用重定向规则替代入口 Worker

单纯的根域跳转可以使用 Cloudflare Single Redirects，减少一个 Worker。Workers Routes 只把请求绑定给 Worker，不能独立执行跳转。

当前线上仍使用已验证的入口 Worker。仓库提供 [规则示例](../config/redirect-rules.example.json)，它是设计示例，不代表已经应用到 Cloudflare。

## 对应规则

1. 根域 GET/HEAD 的 /manage、/login、/logout → admin.724520.xyz/manage，302。
2. 根域 GET/HEAD 的 / → cdn.724520.xyz/，302，保留查询参数。

规则不匹配后台子域名、两个主页子域名、测速子域名、API 或资源路径，避免循环和把接口变成 HTML。多个重定向规则的匹配顺序必须核对，已有规则不能被示例整个覆盖。

## 安全切换顺序

- 需要根域为 Cloudflare 代理记录，以及管理该 Zone 的 Single Redirects 编辑权限。Workers 的 OAuth 权限不一定含规则权限。
- 先备份现有规则和 DNS，合并/添加这两条规则；保留当前入口 Worker 作为兜底。
- 验证 https://724520.xyz/?from=test、片段保留、后台入口、GET/HEAD，以及其他路径/方法不会被误跳转。
- 规则通过后再考虑解除入口 Worker 绑定。解绑可能改变相关 DNS，必须再次确认根域代理记录仍存在。未匹配规则的请求需要有明确的回源/404 策略，不能把一个无效源站留给访客。
- 最后才删除不再使用的入口 Worker；后台、CF 主页、CDN 三个服务保留，尤其不要删除仍托管历史计数 DO 的原主页 Worker。

参考：[Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/)、[查询参数与状态码设置](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/)、[代理要求](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/)。
