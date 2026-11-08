(async () => {
  const settings=await (window.homepageSettingsReady || Promise.resolve(null));
  if(settings?.modules?.pageviews === false || settings?.modules?.footer === false) return;
  const target = document.getElementById('pageview-count');
  if (!target) return;
  async function countVisit() {
    try {
      const endpoint=location.origin==='https://eo.724520.xyz'?'https://admin.724520.xyz/api/pageviews':'/api/pageviews';
      const response = await fetch(endpoint, {
        method: 'POST', cache: 'no-store', credentials: 'omit',
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('Counter unavailable');
      const { total } = await response.json();
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid counter');
      target.textContent = `${total.toLocaleString('zh-CN')} 次`;
    } catch {
      // The POST might have committed before a network failure. Never retry it.
      // EO can still display the existing total using the public read-only API.
      if(location.origin==='https://eo.724520.xyz'){
        try{
          const response=await fetch('https://admin.724520.xyz/api/pageviews',{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(6000)});
          if(!response.ok)throw Error('counter');const {total}=await response.json();if(!Number.isSafeInteger(total)||total<0)throw Error('counter');
          target.textContent=`${total.toLocaleString('zh-CN')} 次`;target.title='已读取总数，本次计数状态暂时无法确认';return;
        }catch{}
      }
      target.textContent = '暂不可用';
    }
  }
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', countVisit, { once: true });
  } else {
    countVisit();
  }
})();
