(() => {
  const $ = id => document.getElementById(id);
  const dialog = $('ticket-dialog');
  if (!dialog || !$('ticket-open')) return;
  const identities = ['摸鱼特派员', '首席闲逛体验官', '互联网街溜子', '无用头衔批发商', '带薪发呆观察员', '正事明天再说研究员'];
  const messages = ['头衔已到账，工资暂未开放。', '本次闲逛没有成果，也没有关系。', '今日份正经事：认真地不干正经事。', '恭喜你，把路过逛成了到此一游。', '小票可以保存，工作不会自动完成。', '你负责随便看看，我负责继续瞎折腾。'];
  let ticket;
  const pick = list => list[Math.floor(Math.random() * list.length)];
  function generate() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(new Date()).map(p => [p.type,p.value]));
    const appearance=window.homepageSettings?.ticket;
    const identityList=appearance?.identities?.length?appearance.identities:identities, messageList=appearance?.messages?.length?appearance.messages:messages;
    const different=(list,previous)=>{const rest=list.filter(v=>v!==previous);return pick(rest.length?rest:list);};
    let identity=different(identityList,ticket?.identity),message=different(messageList,ticket?.message);
    ticket = {date:`${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`, number:`FX-${parts.year}${parts.month}${parts.day}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(-5).padStart(5,'0').toUpperCase()}`, identity, message};
    ticket.appearance=appearance;
    for (const key of ['date','number','identity','message']) $('ticket-'+key).textContent=ticket[key];
    $('ticket-status').textContent = '';
  }
  $('ticket-open').addEventListener('click', () => {generate();dialog.showModal();document.body.classList.add('ticket-is-open');dialog.scrollTop=0;});
  $('ticket-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {document.body.classList.remove('ticket-is-open');$('ticket-open').focus({preventScroll:true});});
  dialog.addEventListener('click', e => {if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  $('ticket-reroll').addEventListener('click', generate);
  $('ticket-save').addEventListener('click', async () => {
    const button=$('ticket-save');button.disabled=true;
    const saved=structuredClone(ticket),custom=saved.appearance||{};
    try {
      await document.fonts.ready;
      const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1320;
      const c=canvas.getContext('2d');if(!c)throw new Error('Canvas unavailable');
      c.fillStyle='#f5f0e3';c.fillRect(0,0,720,1160);c.fillStyle='#31473d';
      const font='system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
      function text(value,x,y,size=24,align='left'){c.font=`${size}px ${font}`;c.textAlign=align;c.fillText(value,x,y,600);}
      function rule(y){c.strokeStyle='#879282';c.setLineDash([7,7]);c.beginPath();c.moveTo(50,y);c.lineTo(670,y);c.stroke();c.setLineDash([]);}
      function wrap(value,y,size=28){c.font=`${size}px ${font}`;let line='';for(const char of value){if(c.measureText(line+char).width>600){text(line,360,y,size,'center');y+=46;line=char;}else line+=char;}if(line)text(line,360,y,size,'center');}
      text('FANXING · NOTHING IMPORTANT',360,66,19,'center');text(custom.shop||'番星闲逛便利店',360,125,40,'center');text(custom.subtitle||'今 日 摸 鱼 凭 证',360,175,25,'center');rule(210);
      text('摸鱼时间',50,254,21);text(saved.date,670,254,22,'right');text('小票编号',50,298,21);text(saved.number,670,298,20,'right');rule(330);
      text('今日身份',50,380,20);text(saved.identity,50,422,29);rule(460);
      text('本次闲逛清单',50,503,21);text('数量',670,503,21,'right');
      (custom.items||['随便逛逛','围观站长折腾','领取无用头衔']).forEach((item,i)=>{text(item,50,555+i*48,26);text('× 1',670,555+i*48,24,'right');});rule(685);
      text('合计',50,735,23);text(custom.total||'正事没干，快乐 +1',670,735,30,'right');
      c.fillStyle='#e6e9dd';c.fillRect(50,775,620,115);c.fillStyle='#31473d';wrap(saved.message,825,27);rule(928);
      text(custom.thanks||'本店不卖东西，只提供闲逛。',360,976,23,'center');text(custom.address||'724520.xyz',360,1028,31,'center');
      let x=220;for(let i=0;i<saved.number.length*3;i++){const w=1+saved.number.charCodeAt(i%saved.number.length)%4;if(x+w>500)break;if(i%2===0)c.fillRect(x,1058,w,45);x+=w+2;}
      text(custom.note||'本票不可报销，可用于证明你摸过鱼。',360,1160,20,'center');text('时间按北京时间记录',360,1200,17,'center');
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG unavailable');
      const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`番星摸鱼凭证-${saved.number}.png`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      $('ticket-status').textContent='小票图片已生成，请查看浏览器下载。';
    } catch { $('ticket-status').textContent='图片暂时没能生成，可以再试一次或截图留念。'; }
    finally {button.disabled=false;}
  });
})();
