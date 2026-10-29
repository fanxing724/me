# 侧栏随身听

前台基于原版 HomePage 布局，参考 imsyy/home 的音乐交互，以原生 Audio 实现；无需 Vue、打包工具或外部播放器脚本。

桌面入口在左侧个人资料栏下方；手机端为独立播放器卡片。支持播放、暂停、上下曲、进度、音量、顺序/单曲循环/随机播放、歌单弹窗、LRC 歌词及本机文件试听。音量和播放模式保存在当前浏览器；默认不自动播放，首次点击播放才设置音频地址。顺序模式播完最后一首停止。

## 站点歌单

编辑 `public/music.json`，例如：

```json
{
  "tracks": [
    {
      "name": "曲名",
      "artist": "艺术家",
      "url": "/assets/music/song.mp3",
      "subtitle": "没有歌词时显示的文字",
      "lrc": "/assets/music/song.lrc",
      "source": "https://example.com/music-credits",
      "sourceLabel": "音乐来源与许可 ↗"
    }
  ]
}
```

除 name 和 url 外，其余字段均可省略。lrc 可为歌词文件 URL 或直接包含时间标签的 LRC 文本。跨域歌词需要来源允许 CORS；音频地址需要浏览器可直接播放。

当前歌单配置为网易云公开歌单 18535155299，通过 api.injahow.cn/meting/ 读取，实测 12 首。保留《月光奏鸣曲》两个 45 秒录音片段作为备用试听素材。演奏者 Juan Felipe Arjona，CC BY 2.5；截取、转码说明及来源链接保存在 `public/assets/music/credits.html`，切换到试听素材时可通过播放器的来源链接打开。

## 网易云 / QQ 歌单

已有可用 Meting 服务时，可将配置改为：

```json
{
  "meting": {
    "endpoint": "https://your-meting.example/api",
    "server": "netease",
    "id": "你的数字歌单ID"
  }
}
```

server 支持 netease 或 tencent；读取 type=playlist，接口需要允许浏览器跨域请求，响应格式为 `[{name,artist,url,lrc}]`。当前已连接用户提供的网易云歌单 18535155299；已验证前三首开始播放：《直到你降临》30秒、《左转灯》约190秒、《爱情讯息》45秒；没有完整听完所有曲目。接口为第三方公共服务，可用性和曲目权限可能变化。

音乐配置是静态文件，现有后台表单暂不编辑该文件。本机音乐通过浏览器对象地址试听，不上传、不写入远程 KV，刷新后恢复站点歌单。

## 本地验证

真实 MP3 解码和时间推进只能证明浏览器在播放；最终音量、音色与听感由用户实际试听确认。当前版本已发布到 https://724520.xyz/ 。本机预览建议使用 Wrangler dev；简易静态服务器若不支持音频 Range，可能无法正常拖动播放进度。

## 弹窗与触屏修正（2026-10-28）

歌单弹窗直接放在 body 下，与侧栏的玻璃效果和层叠关系分离；不支持原生 dialog 时使用备用遮罩与键盘焦点处理。关闭后焦点回到歌单按钮，长歌单在弹窗内滚动，横屏保留关闭和导入入口。

控制图标使用内联 SVG，按钮点击区域至少 44px。播放器和弹窗各自声明按钮样式；播放状态即时同步，再次点击当前歌曲暂停/继续，不再重新从头播放。播放器移除了对 Array.findLast、Array.at 和 AbortSignal.timeout 的依赖。

GitHub、魔搭、Gitee、CNB、AgentScope 按 sitesData 的 profile 分类或已知域名单独显示在左侧「社区主页」，不混入网站与服务卡片。
