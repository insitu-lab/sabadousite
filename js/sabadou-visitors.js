/* Estimativa de navegadores com páginas visíveis, sem nomes, contas ou IPs. */
(()=>{
  'use strict';
  const pages={inicio:'início',avisos:'avisos',musica:'música',galeria:'galeria',jogos:'jogos',fanarts:'fanarts',calabresos:'calabresos',admin:'admin',manutencao:'manutenção',videos:'avisos em vídeo',modelo3d:'bacano 3D'};
  let client=null,channel=null,connected=false,joined=false,busy=false,again=false,panel=null;
  let identity=null,lastPayload='',error=false;
  const tabKey=crypto.randomUUID();
  function browserId(){
    const day=new Date().toISOString().slice(0,10);
    try{
      const saved=JSON.parse(localStorage.getItem('sab_presence_browser')||'null');
      if(saved?.day===day&&/^[a-f0-9-]{36}$/i.test(saved.id))return saved.id;
      const id=crypto.randomUUID();localStorage.setItem('sab_presence_browser',JSON.stringify({day,id}));return id;
    }catch{return identity||(identity=crypto.randomUUID())}
  }
  function page(){
    const fixed=document.body?.dataset.presencePage;if(fixed&&pages[fixed])return fixed;
    let hash='';try{hash=decodeURIComponent(location.hash.slice(1))}catch{return 'inicio'}
    const section=document.getElementById(hash)?.closest('.panel');
    return pages[section?.id]?section.id:'inicio';
  }
  function snapshot(){
    const browsers=new Map();let tabs=0;
    if(connected)for(const rows of Object.values(channel.presenceState()))for(const row of rows){
      if(!/^[a-f0-9-]{36}$/i.test(row.visitor_id)||!Object.hasOwn(pages,row.page))continue;
      if(!browsers.has(row.visitor_id))browsers.set(row.visitor_id,new Set());
      browsers.get(row.visitor_id).add(row.page);tabs++;
    }
    const areas=Object.entries(pages).map(([id,label])=>({id,label,count:[...browsers.values()].filter(values=>values.has(id)).length})).filter(row=>row.count);
    return {count:browsers.size,tabs,areas};
  }
  function render(){
    if(!panel?.isConnected)return;
    const data=snapshot(),count=panel.querySelector('[data-online-count]'),tabs=panel.querySelector('[data-online-tabs]'),list=panel.querySelector('[data-online-pages]'),status=panel.querySelector('[data-online-status]');
    count.textContent=connected?data.count:'—';tabs.textContent=connected?data.tabs:'—';
    const items=data.areas.map(row=>{
      const li=document.createElement('li'),label=document.createElement('span'),value=document.createElement('b');
      label.textContent=row.label;value.textContent=row.count;li.append(label,value);return li;
    });
    list.replaceChildren(...items);
    status.textContent=connected?'Conectado · atualiza automaticamente.':error?'Conexão com a presença indisponível. Verifique o Realtime do projeto Supabase; tentarei reconectar.':'Conectando à presença em tempo real…';
  }
  async function publish(){
    if(!connected||!channel)return;
    if(busy){again=true;return}
    busy=true;const current=channel;
    try{
      const visible=!document.hidden;
      if(!visible){if(joined)await current.untrack();joined=false;lastPayload='';return}
      const payload={visitor_id:browserId(),page:page()},signature=JSON.stringify(payload);
      if(joined&&signature===lastPayload)return;
      const result=await current.track(payload);
      if(channel!==current)return;
      if(result==='ok'){joined=true;lastPayload=signature;error=false}else{error=true;lastPayload=''}
    }catch{error=true;lastPayload=''}
    finally{busy=false;render();if(again){again=false;publish()}}
  }
  function attachClient(value){
    if(client===value&&channel)return;
    const previous=channel,previousClient=client;
    client=value;connected=joined=false;lastPayload='';
    if(previous&&previousClient)previousClient.removeChannel(previous);
    channel=client.channel('sabadou-online-v1',{config:{presence:{key:tabKey}}});
    const current=channel;
    current.on('presence',{event:'sync'},()=>{if(channel===current)render()})
      .subscribe(status=>{
        if(channel!==current)return;
        connected=status==='SUBSCRIBED';
        if(!connected){joined=false;lastPayload='';error=['CHANNEL_ERROR','TIMED_OUT'].includes(status)}
        else{error=false;publish()}
        render();
      });
    render();
  }
  function mountAdmin(parent){
    panel?.remove();panel=document.createElement('section');panel.className='ed';panel.id='admin-online';
    panel.innerHTML='<h3>online agora</h3><p class="mut" style="margin:0">Navegadores com uma página visível, incluindo visitantes sem login e sua própria visita.</p><div class="online-metrics"><div><strong data-online-count>—</strong><span>navegadores ativos</span></div><div><strong data-online-tabs>—</strong><span>abas visíveis</span></div></div><h4>onde estão</h4><ul class="online-pages" data-online-pages></ul><p class="mut" data-online-status role="status"></p><p class="hint">É uma estimativa, não pessoas identificadas. Abas do mesmo navegador são agrupadas; aparelhos e navegadores diferentes contam separadamente. Abas ocultas saem da contagem. Uma queda de conexão pode levar alguns segundos para aparecer. A soma por área pode incluir o mesmo navegador em mais de uma área.</p>';
    parent.append(panel);render();
  }
  window.SabadouVisitors={attachClient,mountAdmin};
  addEventListener('hashchange',()=>publish());
  addEventListener('online',()=>publish());
  addEventListener('pageshow',()=>publish());
  addEventListener('pagehide',()=>{if(channel){channel.untrack().catch(()=>{});joined=false;lastPayload=''}});
  addEventListener('storage',event=>{if(event.key==='sab_presence_browser')publish()});
  document.addEventListener('visibilitychange',()=>publish());
  setInterval(()=>{if(connected)publish()},30000);
  function start(){
    // Páginas comuns aproveitam o cliente que já verifica a manutenção.
    if(['manutencao','modelo3d'].includes(document.body?.dataset.presencePage))window.SabadouMaintenance?.connectRealtime().catch(()=>{error=true;render()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
