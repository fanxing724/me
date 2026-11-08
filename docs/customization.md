# 主页统一自定义与访问入口

## 使用

后台：https://admin.724520.xyz/manage ，沿用原账号。

- 音乐：启停、网易云/QQ 歌单链接或 ID、自定义曲目、封面与歌词、曲目排序、测试读取与试听、默认音量和模式、本机音乐入口。
- 视觉：强调色、面板圆角、字号、桌面宽度、背景遮罩/模糊、网站卡片列数、装饰动画。
- 模块：IP、GitHub 贡献图、网站、社区、电脑档案、项目、技能、小票、标签、徽章、页脚、访问量显隐；右侧模块上下排序。
- 文案：区域标题、徽章列表、公告、小票店名/身份/留言/清单/按钮、电脑信息与维修手记、页脚与源码链接。
- 个人资料：昵称、状态表情、GitHub 用户名、位置、状态、标签、介绍；头像和背景仍在外观与素材中。
- 线路：测速标题、简介、站名、两条线路名称与启停、超时、自动跳转。至少保留一条线路。

表单编辑均为草稿，顶部保存后发布。歌单测试和历史恢复不直接发布。字体/色彩样例只是局部预览；完整视觉效果保存后查看公开主页。访客已经选择的音乐音量和播放模式优先于后台默认值。浏览器不会被强制自动播放。

设置与原主页内容分别保存，界面合并为同一个保存按钮。如果其中一类保存失败，会保留尚未保存的草稿并提示；两类保存不是跨存储事务。可以导出草稿备份，再重新加载处理版本冲突。

## 配置服务

原 portfolio_data、管理员账号和签名密钥仍保存在原 KV，不重新初始化。

新的 HomepageSettings SQLite Durable Object 托管于独立后台，实例名 homepage-settings。`/api/settings` GET 返回公开设置/版本/更新时间，POST 要求后台登录、同源 Origin 和 expectedVersion。SQLite 事务保证配置版本比较与保存原子完成，冲突返回 409；只保存不同内容，最多保留最近 12 版。历史读取 `/api/settings/history` 也要求登录。历史恢复只改设置，不改内容或账号。

`/api/music` 只公开播放配置；CF 通过 Service Binding，EO 通过固定后台地址转发公开配置，不转发访客 Cookie。两边第一次加载先有静态快照，读取失败保留快照。保存后的新设置在访客下次打开/刷新时应用，不会中断正在播放的音乐。

关闭音乐、IP、贡献图、访问量时，前端也停止对应网络请求。没有数据的项目/技能模块即使启用也不显示空容器。

完整备份 v2 包含主页内容和自定义设置，不包含凭据。旧格式内容备份仍可导入。导入先进入编辑区，保存才发布。

## 四个 Worker

| 域名 | Worker | 用途 |
|---|---|---|
| admin.724520.xyz | fanxing-homepage-admin | 后台、内容、配置与计数接口 |
| cf.724520.xyz | fanxing-homepage | CF 公开主页及历史访问量 DO 的托管者 |
| cdn.724520.xyz | fanxing-homepage-cdn | 读取后台线路配置，浏览器并发选线 |
| 724520.xyz | fanxing-homepage-entry | 独立轻量入口，仅临时跳转 |

EO 是独立手动部署的 Pages 项目。根域重新绑定的是新的跳转 Worker，没有恢复旧前后台合一服务或 fast 路由。

网关探测两个指定域名的 /cdn-check，校验 200 与 JSON 标记。首个健康响应获选，不是吞吐量测试，也不保证按地域固定选平台。禁用 JS、检测超时或网络失败时仍可点击线路。`?manual=1` 不自动跳转，检测后也留在选择页。页面沿用上游字体设置；头像内嵌，背景由网关静态资源提供。主域名 302/no-store，后台导航固定到 admin 域名，保留 query/hash，API 和静态路径不经过测速 HTML。

## 构建与发布

后台：`python3 tools/build-backend.py` 后，`wrangler deploy --config wrangler.backend.deploy.jsonc`。

公开主页：`python3 tools/refresh-homepage-snapshot.py` 后，`wrangler deploy --config wrangler.deploy.jsonc`。

EO：`python3 tools/build-edgeone.py`，将 dist-edgeone 内容打包到 ZIP 根层，再直接上传。代码更新需重新上传；上传新前端一次后，日常配置修改无需重新打包。

测速页：`node gateway/build.mjs` 后，`wrangler deploy --config wrangler.gateway.deploy.jsonc`。

根域入口：`wrangler deploy --config wrangler.entry.deploy.jsonc`。

实际账户配置全部使用被 Git 忽略的 *.deploy.jsonc；仓库提供不含账户 ID 的模板。不要删除原 PageViewCounter 导出、绑定和 pageviews-v1 迁移。新 HomepageSettings 状态独立于历史访问量。

## 验证与回退


回退设置：后台设置历史恢复到编辑区，保存为一个新版本；新版本保留当前修订链。完整内容回退使用内容备份，不恢复账号信息。

回退代码：恢复任务 backups 下的源码与配置并重新发布。回退后台时应保留 SITE_SETTINGS 绑定、HomepageSettings 导出及其迁移记录，或只使用 Worker 版本回滚并保留存储；不要通过 deleted_classes 删除设置历史。根域可以单独解绑或替换跳转 Worker，不影响后台和公开主页数据。
