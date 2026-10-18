/* Conversa autenticada. A chave da IA nunca passa pelo navegador. */
(()=>{
  'use strict';
  const form=document.getElementById('chat-form');if(!form)return;
  const find=id=>document.getElementById(id),input=find('chat-input'),send=find('chat-send'),status=find('chat-status');
  const log=find('chat-messages'),login=find('chat-login'),account=find('chat-account'),clear=find('chat-clear');
  const cfg=typeof SITE_CONFIG!=='undefined'?SITE_CONFIG:(window.SITE_CONFIG||{});
  const catalog=window.SabadouPoses;
  if(!catalog?.idle){status.textContent='Não consegui carregar a conversa por completo. Recarregue a página.';return}
  const gestures=new Set(Object.keys(catalog));
  let client=null,user=null,auth=null,history=[],busy=false,epoch=0,controller=null,lastExpression=null;
  let cooldownUntil=0,cooldownTimer=null,cooldownSource='',isAdmin=false,privilegeRevision=0;
  const voice=window.SabadouVoice?.mount({
    onStart:payload=>window.SabadouCharacter?.startSpeech?.(payload),
    onChunk:info=>window.SabadouCharacter?.speechChunk?.(info),
    onBoundary:info=>window.SabadouCharacter?.speechBoundary?.(info),
    onPause:value=>window.SabadouCharacter?.speechPause?.(value),
    onEnd:()=>window.SabadouCharacter?.endSpeech?.()
  });
  function message(role,text){
    const article=document.createElement('article'),label=document.createElement('small'),body=document.createElement('p');
    article.className='chat-message '+role;label.textContent=role==='user'?'você':role==='welcome'?'boas-vindas':'bacano · IA';
    body.textContent=text;article.append(label,body);log.append(article);
    // Só os últimos turnos permanecem no DOM e na memória da página.
    while(log.children.length>25)log.firstElementChild.remove();
    log.scrollTop=log.scrollHeight;return article;
  }
  function announce(text,error=false){status.textContent=text;status.dataset.error=String(error)}
  function controls(){
    const wait=Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000));
    const waitLabel=wait<60?'aguarde '+wait+'s':wait<3600?'aguarde '+Math.ceil(wait/60)+' min':'aguarde '+Math.ceil(wait/3600)+' h';
    send.disabled=!client||busy||wait>0;send.textContent=busy?'pensando…':wait?waitLabel:user?'enviar ↗':'entrar para conversar';
    input.readOnly=busy;login.disabled=!client||busy;clear.disabled=false;
    document.querySelectorAll('[data-chat-prompt]').forEach(button=>button.disabled=busy);
    form.setAttribute('aria-busy',String(busy));
  }
  function express(payload){
    lastExpression=payload;
    if(window.SabadouCharacter?.ready)window.SabadouCharacter.express(payload).catch(()=>{});
  }
  function reset(){
    epoch++;controller?.abort();controller=null;busy=false;history=[];lastExpression=null;
    voice?.clear();
    window.SabadouCharacter?.stop().catch(()=>{});log.replaceChildren();
    message('welcome','E aí, calabreso! Manda uma ideia ou pergunta sobre o Sabadou. Vamos criar algo bacana juntos?');
    controls();
  }
  function applySession(session){
    const next=session?.user||null;
    if(next?.id!==user?.id){
      isAdmin=false;cooldownUntil=0;cooldownSource='';clearInterval(cooldownTimer);cooldownTimer=null;
      const draft=!user&&next?input.value:'';reset();input.value=draft;find('chat-count').textContent=draft.length+'/600';
    }
    user=next;
    account.textContent=user?(user.user_metadata?.handle?'@'+user.user_metadata.handle:'conta conectada'):'Você ainda não entrou.';
    login.textContent=user?'sair':'entrar com @';
    if(!busy)announce(user?'Pode mandar sua mensagem.':'Entre com sua conta do Sabadou para conversar.');controls();
    const revision=++privilegeRevision;
    if(user)refreshPrivileges(user.id,revision);
  }
  async function refreshPrivileges(owner,revision){
    try{
      const {data,error}=await client.rpc('is_admin');
      if(revision!==privilegeRevision||user?.id!==owner)return;
      isAdmin=!error&&data===true;
      if(isAdmin){
        account.textContent='admin';
        if(cooldownSource==='site'){cooldownUntil=0;cooldownSource='';clearInterval(cooldownTimer);cooldownTimer=null}
      }
      controls();
    }catch{if(revision===privilegeRevision)isAdmin=false}
  }
  const fanAuth=window.SabadouFanAuth.mount({getClient:()=>client,
    onSignedIn:async()=>{const {data}=await client.auth.getSession();applySession(data.session);input.focus()},
    copy:{signInHint:'Entre com o mesmo @ e senha que você já usa no Sabadou.',createHint:'Use seu @ do Instagram e uma senha nova para o Sabadou.'}
  });
  find('chat-login-close').onclick=()=>find('ul').close();
  login.onclick=async()=>{
    if(!client||busy)return;
    if(!user){fanAuth.open();return}
    voice?.stop();
    login.disabled=true;
    const {error}=await client.auth.signOut({scope:'local'});
    if(error){announce('Não consegui sair agora. Tente novamente.',true);controls()}else applySession(null);
  };
  input.addEventListener('input',()=>{find('chat-count').textContent=input.value.length+'/600'});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!send.disabled)form.requestSubmit()}
  });
  document.querySelectorAll('[data-chat-prompt]').forEach(button=>button.onclick=()=>{
    input.value=button.dataset.chatPrompt;input.dispatchEvent(new Event('input'));input.focus();
  });
  clear.onclick=()=>{reset();input.value='';input.dispatchEvent(new Event('input'));announce('Conversa limpa. Pode começar outra ideia.');input.focus()};
  function cooldown(seconds,source='provider'){
    if(isAdmin&&source==='site')return;
    cooldownSource=source;
    cooldownUntil=Date.now()+Math.max(1,Math.min(86400,Number(seconds)||5))*1000;
    clearInterval(cooldownTimer);cooldownTimer=setInterval(()=>{
      controls();if(Date.now()>=cooldownUntil){clearInterval(cooldownTimer);cooldownTimer=null}
    },1000);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!client||busy||Date.now()<cooldownUntil)return;
    const text=input.value.trim();if(!text||text.length>600)return;
    if(!user){fanAuth.open();return}
    voice?.stop();
    const turn=++epoch,owner=user.id;busy=true;controls();announce('O bacano está pensando…');
    window.SabadouCharacter?.setThinking?.(true);
    const item=message('user',text),request=new AbortController();controller=request;
    const timeout=setTimeout(()=>request.abort(),55000);
    try{
      const {data,error}=await client.auth.getSession();
      if(error||!data.session||data.session.user.id!==owner)throw {code:'auth',message:'Sua sessão terminou. Entre novamente.'};
      if(epoch!==turn)return;
      const response=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/functions/v1/bacano-chat',{
        method:'POST',headers:{apikey:cfg.supabaseKey,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({message:text,history:history.slice(-8),scene:window.SabadouCharacter?.perceive?.()||null}),signal:request.signal,cache:'no-store'
      });
      const result=await response.json().catch(()=>null);
      if(epoch!==turn)return;
      if(!response.ok){
        if(response.status===429){
          const siteQuota=['daily_limit','global_limit','rate_limit'].includes(result?.code)||/^(Você chegou ao limite de 40|O limite de conversas do site por hoje|Vamos com calma, calabreso)/.test(result?.error||'');
          cooldown(result?.retryAfter||response.headers.get('Retry-After'),siteQuota?'site':'provider');
        }
        const codes={401:'Sua sessão terminou. Entre novamente.',404:'A conversa ainda está sendo ativada. Tente novamente mais tarde.'};
        throw {code:response.status===401?'auth':'request',message:codes[response.status]||(typeof result?.error==='string'?result.error:'Não consegui responder agora. Tente novamente.')};
      }
      if(!result||typeof result.text!=='string'||!result.text.trim()||result.text.length>360||!gestures.has(result.gesture))throw {message:'Recebi uma resposta incompleta. Tente novamente.'};
      message('assistant',result.text);history=[...history,{role:'user',text},{role:'assistant',text:result.text}].slice(-8);
      input.value='';input.dispatchEvent(new Event('input'));express(result);
      voice?.setResponse(result);
      announce('Resposta recebida.');
    }catch(error){
      if(epoch!==turn)return;
      item.classList.add('failed');const delivery=document.createElement('p');delivery.className='delivery';delivery.textContent='sem resposta · tente enviar novamente';item.append(delivery);
      const networkError=error instanceof TypeError&&/fetch|network|load/i.test(error.message);
      announce(error.name==='AbortError'?'A resposta demorou demais. Sua mensagem continua na caixa; tente novamente.':networkError?'Não consegui conectar à conversa. Ela pode estar temporariamente indisponível. Tente novamente mais tarde.':error.message||'Não consegui conectar à conversa. Confira sua conexão.',true);
      express({gesture:'idle',text:''});
      if(error.code==='auth'){await client.auth.signOut({scope:'local'});fanAuth.open()}
    }finally{
      clearTimeout(timeout);
      if(epoch===turn){window.SabadouCharacter?.setThinking?.(false);busy=false;controller=null;controls();input.focus()}
    }
  });
  addEventListener('sabadou:character-ready',()=>{
    if(lastExpression)express(lastExpression);
    const speech=voice?.getState();
    if(speech?.active){window.SabadouCharacter.startSpeech?.(speech.payload);window.SabadouCharacter.speechChunk?.(speech.chunk)}
    window.SabadouCharacter?.setThinking?.(busy);
  });
  addEventListener('pagehide',()=>{reset();input.value='';clearInterval(cooldownTimer)});
  addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    if(Date.now()<cooldownUntil)cooldown(Math.ceil((cooldownUntil-Date.now())/1000),cooldownSource||'provider');
    announce(user?'Conversa limpa ao sair da página. Pode começar outra ideia.':'Entre com sua conta do Sabadou para conversar.');controls();
  });
  reset();
  (async()=>{
    try{
      await window.SabadouMaintenance.connectRealtime();client=window.SabadouMaintenance.getClient();
      if(!client)throw new Error('Sem conexão com o login.');
      const {data,error}=await client.auth.getSession();if(error)throw error;applySession(data.session);
      auth=client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>applySession(session),0)).data.subscription;
      addEventListener('pagehide',event=>{if(!event.persisted)auth?.unsubscribe()});
    }catch{announce('Não consegui conectar ao login. Confira a conexão e recarregue a página.',true);controls()}
  })();
})();
