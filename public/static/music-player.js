(() => {
  'use strict';
  const panel = document.querySelector('#music-player');
  if (!panel) return;
  const $ = selector => document.querySelector(selector);
  const audio = $('#music-audio');
  const icons = {
    play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M9 5v14M16 5v14" stroke-width="3"/>',
    previous: '<path d="M6 5v14m13-14-10 7 10 7Z"/>',
    next: '<path d="M18 5v14M5 5l10 7-10 7Z"/>',
    sequence: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
    repeat: '<path d="M20 7H7a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-2M17 4l3 3-3 3"/><path d="M12 10v4"/>',
    shuffle: '<path d="M3 6h3c4 0 8 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>'
  };
  function setIcon(button, name) {
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
  }
  [['#music-prev','previous'],['#music-next','next'],['#music-open-list','list'],['#music-close-list','close']].forEach(([selector,name])=>setIcon($(selector),name));
  const dialog = $('#music-dialog');
  const playButton = $('#music-play');
  const status = $('#music-status');
  const seek = $('#music-seek');
  const modes = ['sequence', 'repeat', 'shuffle'];
  const modeNames = {sequence:'顺序播放', repeat:'单曲循环', shuffle:'随机播放'};
  let tracks = [], index = -1, mode = 'sequence', lyrics = [], lyricRequest = 0, playRequest = 0;
  let localFiles = false;
  const objectURLs = [];
  const saved = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const volume = Number(saved('fanxing-music-volume') ?? 0.5);
  audio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.5;
  $('#music-volume').value = audio.volume;
  if (modes.includes(saved('fanxing-music-mode'))) mode = saved('fanxing-music-mode');
  const formatTime = value => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2,'0')}` : '0:00';
  function url(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try { const parsed = new URL(value, location.origin); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
  }
  function message(text) { status.textContent = text; }
  async function timedFetch(target, options = {}, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await fetch(target, {...options,signal:controller.signal}); }
    finally { clearTimeout(timer); }
  }
  function updateState() {
    const playing = !audio.paused && !audio.ended;
    setIcon(playButton, playing ? 'pause' : 'play');
    playButton.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    panel.classList.toggle('is-playing', playing);
    dialog.querySelectorAll('[data-track]').forEach(button => {
      const current = Number(button.dataset.track) === index;
      button.setAttribute('aria-current', current ? 'true' : 'false');
      button.querySelector('.music-track-number').textContent = String(Number(button.dataset.track) + 1).padStart(2, '0');
      const isPlaying = current && playing;
      setIcon(button.querySelector('.music-track-action'), isPlaying ? 'pause' : 'play');
      button.setAttribute('aria-label', `${isPlaying ? '暂停' : '播放'} ${tracks[Number(button.dataset.track)].name}`);
    });
  }
  function updateTime() {
    const duration = audio.duration;
    const valid = Number.isFinite(duration) && duration > 0;
    seek.disabled = !valid;
    seek.value = valid ? audio.currentTime / duration * 1000 : 0;
    $('#music-current').textContent = formatTime(audio.currentTime);
    $('#music-duration').textContent = valid ? formatTime(duration) : '--:--';
    seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} / ${formatTime(duration)}`);
    let line;
    for (let i=lyrics.length-1;i>=0;i--) { if(lyrics[i].time<=audio.currentTime){line=lyrics[i];break;} }
    $('#music-lyric').textContent = line?.text || tracks[index]?.subtitle || '给路过的你，一点背景音乐。';
  }
  function parseLRC(text) {
    const result = [];
    for (const line of text.split(/\r?\n/)) {
      const content = line.replace(/\[.*?\]/g,'').trim();
      for (const match of line.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d+)?)\]/g)) {
        if (content) result.push({time:Number(match[1])*60+Number(match[2]),text:content});
      }
    }
    return result.sort((a,b) => a.time-b.time);
  }
  async function loadLyrics(track) {
    const request = ++lyricRequest;
    lyrics = [];
    if (!track.lrc) return;
    try {
      let text = track.lrc;
      if (!/\[\d+:\d+/.test(text)) {
        const target = url(text); if (!target) return;
        const response = await timedFetch(target, {credentials:'omit'});
        if (!response.ok) return;
        text = await response.text();
      }
      if (request === lyricRequest) { lyrics = parseLRC(text); updateTime(); }
    } catch { /* Lyrics are optional; playback remains available. */ }
  }
  async function play() {
    if (index < 0) { message('先从歌单选择一首，或添加本机音乐。'); return; }
    const request = ++playRequest;
    message('正在加载音乐…');
    if (audio.getAttribute('src') !== tracks[index].url) { audio.src = tracks[index].url; audio.load(); }
    try {
      await audio.play();
      if (request === playRequest) message('正在播放 · '+tracks[index].name);
    } catch (error) {
      if (request !== playRequest || error.name === 'AbortError') return;
      message(error.name === 'NotAllowedError' ? '浏览器需要你再点一次播放。' : '这首暂时无法播放，可换一首或添加本机音乐。');
      updateState();
    }
  }
  function select(next, autoplay = false) {
    if (!tracks.length) return;
    ++playRequest;
    audio.pause();
    index = (next + tracks.length) % tracks.length;
    const track = tracks[index];
    audio.removeAttribute('src');
    audio.load();
    $('#music-name').textContent = track.name;
    $('#music-artist').textContent = track.artist || '未知艺术家';
    $('#music-lyric').textContent = track.subtitle || '给路过的你，一点背景音乐。';
    const source = $('#music-source');
    const sourceURL = url(track.source);
    source.hidden = !sourceURL;
    if (sourceURL) { source.href = sourceURL; source.textContent = track.sourceLabel || '音乐来源 ↗'; }
    loadLyrics(track);
    updateTime(); updateState();
    message('已选择 · '+track.name);
    if (autoplay) play();
  }
  function nextIndex(direction = 1) {
    if (mode === 'shuffle' && tracks.length > 1) return (index + 1 + Math.floor(Math.random()*(tracks.length-1))) % tracks.length;
    return (index + direction + tracks.length) % tracks.length;
  }
  function renderList() {
    const list = $('#music-tracks'); list.replaceChildren();
    tracks.forEach((track, position) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.track = position;
      const number = document.createElement('span'); number.className = 'music-track-number';
      const info = document.createElement('span'); info.className = 'music-track-info';
      const name = document.createElement('strong'); name.textContent = track.name;
      const artist = document.createElement('small'); artist.textContent = track.artist || '未知艺术家';
      const action = document.createElement('span'); action.className = 'music-track-action';
      info.append(name, artist); button.append(number,info,action);
      button.addEventListener('click', () => {
        if (position === index) togglePlayback();
        else select(position,true);
      });
      item.append(button); list.append(item);
    });
    $('#music-count').textContent = `${tracks.length} 首`;
    $('#music-empty').hidden = Boolean(tracks.length);
    [playButton,$('#music-prev'),$('#music-next')].forEach(button => button.disabled = !tracks.length);
    updateState();
  }
  function updateMode() {
    audio.loop = mode === 'repeat';
    setIcon($('#music-mode'),mode);
    $('#music-mode').setAttribute('aria-label', `当前${modeNames[mode]}，点击切换播放顺序`);
    $('#music-mode').title = modeNames[mode];
  }
  function togglePlayback() {
    if (audio.paused || audio.ended) play();
    else { ++playRequest; audio.pause(); updateState(); message('已暂停'); }
  }
  playButton.addEventListener('click', togglePlayback);
  $('#music-prev').addEventListener('click', () => select(nextIndex(-1),true));
  $('#music-next').addEventListener('click', () => select(nextIndex(),true));
  $('#music-mode').addEventListener('click', () => {
    mode = modes[(modes.indexOf(mode)+1)%modes.length]; save('fanxing-music-mode',mode); updateMode(); message(modeNames[mode]);
  });
  $('#music-volume').addEventListener('input', event => { audio.volume = Number(event.target.value); save('fanxing-music-volume',audio.volume); });
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value)/1000*audio.duration; });
  const nativeDialog = typeof dialog.showModal === 'function';
  let returnFocus = null;
  const shade = document.createElement('div'); shade.className = 'music-dialog-shade'; shade.hidden = true;
  document.body.append(shade);
  function closeList() {
    if (nativeDialog) dialog.close();
    else { dialog.removeAttribute('open'); shade.hidden = true; }
    document.documentElement.classList.remove('music-modal-open');
    returnFocus?.focus({preventScroll:true});
  }
  function openList() {
    returnFocus = document.activeElement;
    if (nativeDialog) { if (!dialog.open) dialog.showModal(); }
    else { dialog.dataset.fallback = ''; dialog.setAttribute('open',''); dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); shade.hidden = false; }
    document.documentElement.classList.add('music-modal-open');
    $('#music-close-list').focus({preventScroll:true});
  }
  $('#music-open-list').addEventListener('click', openList);
  $('#music-close-list').addEventListener('click', closeList);
  shade.addEventListener('click', closeList);
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('music-modal-open');
    returnFocus?.focus({preventScroll:true});
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !nativeDialog) { event.preventDefault(); closeList(); }
    if (event.key === 'Tab' && !nativeDialog) {
      const controls = [...dialog.querySelectorAll('button:not(:disabled),input,a[href]')].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) closeList(); } });
  $('#music-files').addEventListener('change', event => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac|opus)$/i.test(file.name));
    if (!files.length) { message('请选择音频文件。'); return; }
    ++playRequest; audio.pause(); audio.removeAttribute('src'); audio.load();
    objectURLs.splice(0).forEach(value => URL.revokeObjectURL(value));
    tracks = files.map(file => { const value = URL.createObjectURL(file); objectURLs.push(value); return {name:file.name.replace(/\.[^.]+$/,''),artist:'本机音乐',url:value,subtitle:'仅在当前浏览器播放，不上传文件。'}; });
    localFiles = true; renderList(); select(0); event.target.value = '';
    message(`已添加 ${tracks.length} 首本机音乐，点击播放开始试听。`);
  });
  audio.addEventListener('play',updateState); audio.addEventListener('pause',updateState);
  audio.addEventListener('ended', () => {
    updateState();
    if (mode === 'sequence' && index === tracks.length-1) { message('歌单已播放完毕'); return; }
    select(nextIndex(),true);
  });
  audio.addEventListener('error', () => { if (audio.getAttribute('src')) { message('这首暂时无法播放，可换一首或添加本机音乐。'); updateState(); } });
  audio.addEventListener('waiting', () => message('正在缓冲音乐…'));
  audio.addEventListener('playing', () => message('正在播放 · '+tracks[index].name));
  audio.addEventListener('timeupdate',updateTime); audio.addEventListener('durationchange',updateTime);
  panel.addEventListener('keydown',event => {
    if(event.code==='Space' && event.target===panel && !playButton.disabled) {event.preventDefault();playButton.click();}
  });
  updateMode(); renderList();
  (async()=>{
    try {
      const response = await timedFetch('/music.json');
      if (!response.ok) throw Error('config');
      const config = await response.json();
      let entries = Array.isArray(config.tracks) ? config.tracks : [];
      if (config.meting?.endpoint && /^\d+$/.test(String(config.meting.id))) {
        const endpoint = url(config.meting.endpoint);
        if (endpoint) {
          const target = new URL(endpoint); target.searchParams.set('server',config.meting.server==='tencent'?'tencent':'netease');target.searchParams.set('type','playlist');target.searchParams.set('id',config.meting.id);
          const playlist = await timedFetch(target, {credentials:'omit'}, 10000);
          if (!playlist.ok) throw Error('playlist');
          const result = await playlist.json(); if (!Array.isArray(result)) throw Error('playlist'); entries = result;
        }
      }
      if (localFiles) return;
      tracks = entries.slice(0,200).filter(track => track && typeof track.name === 'string' && url(track.url)).map(track=>({...track,url:url(track.url)}));
      renderList();
      if (tracks.length) select(0);
      else message('打开歌单，添加本机音乐试试看。');
    } catch { if (!localFiles) message('歌单暂时未能加载，可打开歌单添加本机音乐。'); }
  })();
})();
