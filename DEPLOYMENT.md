# 部署与恢复

主页：https://724520.xyz/
工作台：https://724520.xyz/manage
优选入口：https://fast.724520.xyz/
Workers 备用：https://fanxing-homepage.fananxing.workers.dev/

## 代码与内容

- `worker.mjs`：Worker 路由、Cookie 鉴权、KV 内容和访客网络提示。
- `public/`：已发布的个人主页、静态资源与音乐配置。
- `admin/index.html`、`admin/login.html`：后台与登录页模板；运行 `python3 tools/build-admin.py` 生成 `admin/pages.mjs`。
- `public/static/admin-theme.css`：统一后台视觉；`original-adapter.css` 管理主页适配和紧凑卡片。
- `public/music.json`：静态歌单设置，见 [播放器说明](docs/music-player.md)。

后台保存修改会写入 KV 的 `portfolio_data`，无需重新部署。账号凭据与站点内容分开存储。仓库不包含实际登录密码、账号绑定或 Cloudflare 授权令牌。

## 部署

1. 安装 Node.js 和 Wrangler，使用自己的 Cloudflare 账号登录。
2. 将 `wrangler.jsonc` 复制为 `wrangler.deploy.jsonc`，填写自己的 `account_id` 和 `MY_HOME_KV` 绑定，修改域名路由；私有配置已加入 Git 忽略。
3. 使用自己的内容备份初始化 `portfolio_data`。管理员凭据需要单独初始化，不能使用上游示例密码。
4. 修改后台 HTML 后执行 `python3 tools/build-admin.py`；需要刷新公开页面快照时执行 `python3 tools/refresh-homepage-snapshot.py`。
5. 执行 `wrangler deploy --config wrangler.deploy.jsonc`。

当前管理员凭据格式为 `{username,salt,hash}`：PBKDF2-SHA256、100000 次迭代、32 字节结果，salt 和 hash 为十六进制文本。登录后可在账号安全页修改用户名和密码。不要把凭据、Cookie 或真实部署配置提交到 Git。

## 缓存与恢复

首页先显示内置的公开内容快照，再读取 `/api/data`。接口不可用时使用最近部署的快照。静态样式与脚本缓存一天；更新时同步更改 HTML 中的版本参数，更新图片时更换文件名。

发布前保留旧 Worker 版本与内容备份。代码通过 Wrangler 的版本回滚恢复；内容通过后台 JSON 备份恢复，导入前先导出当前内容。代码回滚不会自动回滚 KV。

## 当前发布验证

2026-10-28 发布版本 `72583eea-b6b9-49f2-b2b7-fc4bf90f30e8`：

- 主页网站卡片统一144px高，17个网站与5个社区入口独立展示。
- 网易云歌单 `14060893647` 读取45首，抽样播放和歌词通过；部分曲目仅30秒试听。
- 登录页及后台七个栏目采用统一深蓝配色、系统字体和手机适配。
- Chromium/WebKit本地布局与模拟编辑保存通过；真实线上登录、只读查看、编辑弹窗、退出通过，发布验证未写远程内容。

EdgeOne 备用部署尚属本机实验，本次源码发布不包含该实验或可用性承诺。

## 手机体验与歌单更新（2026-10-29）

手机增加网站/音乐/社区快捷导航；入口卡片直接显示，取消整页加载后淡出重现，手机背景粒子由30减为8，减少动态偏好下停用粒子。背景切换使用44px原生按钮并支持键盘、可读标签和状态。网站入口全部直接展示，不增加搜索或分类。

歌单切换为用户提供的网易云18535155299，接口返回12首；Chromium实测前三首开始播放，时长分别为30秒、约190秒与45秒。Chromium/WebKit在320–1440px八种宽度验证无横向溢出，17个网站卡片保持144px等高、5个社区入口、背景键盘切换及歌单弹窗焦点恢复正常。

本轮工作树与验证记录：`/home/fanxing/codex-workspace/homepage-refine-20261029/`。发布前版本为72583eea-b6b9-49f2-b2b7-fc4bf90f30e8；代码可由Wrangler回滚，本轮不写远程KV。
