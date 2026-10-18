/* Leitura local das respostas. Sem microfone, chave ou serviço de TTS externo. */
(()=>{
  'use strict';
  window.SabadouVoice={mount({onStart=()=>{}}={}){
    const find=id=>document.getElementById(id),toggle=find('voice-toggle'),replay=find('voice-replay');
    const stopButton=find('voice-stop'),select=find('voice-select'),status=find('voice-status');
    if(!toggle||!replay||!stopButton||!select||!status)return {setResponse(){},stop(){},clear(){}};
    const supported='speechSynthesis' in window&&typeof window.SpeechSynthesisUtterance==='function';
    const synth=supported?window.speechSynthesis:null;
    let enabled=false,voices=[],last=null,token=0,utterances=[],speaking=false,startTimer=null,endTimer=null;
    function announce(text){status.textContent=text}
    function controls(){
      toggle.disabled=!supported;toggle.textContent=enabled?'desativar voz':'ativar voz';
      toggle.setAttribute('aria-pressed',String(enabled));
      replay.disabled=!supported||!voices.length||!last?.text;
      stopButton.disabled=!speaking;select.disabled=!voices.length;
    }
    function voice(){return voices.find(item=>item.voiceURI===select.value)||voices[0]}
    function refresh(){
      const previous=select.value;
      try{
        // Usa explicitamente serviços locais. Não recorre a uma voz remota.
        voices=(synth?.getVoices()||[]).filter(item=>item.localService===true&&/^pt(?:[-_]|$)/i.test(item.lang));
      }catch{voices=[]}
      const rank=item=>(/^pt[-_]BR$/i.test(item.lang)?4:0)+(item.default?1:0);
      voices.sort((a,b)=>rank(b)-rank(a)||a.name.localeCompare(b.name));select.replaceChildren();
      if(!voices.length){
        const option=document.createElement('option');option.value='';option.textContent='voz em português indisponível';select.append(option);
      }else{
        for(const item of voices){const option=document.createElement('option');option.value=item.voiceURI;option.textContent=item.name+' · '+item.lang;select.append(option)}
        if(voices.some(item=>item.voiceURI===previous))select.value=previous;
      }
      controls();
    }
    function cancel(){
      token++;clearTimeout(startTimer);clearTimeout(endTimer);speaking=false;utterances=[];
      if(synth)try{synth.cancel()}catch{}
      controls();
    }
    function chunks(text){
      const parts=[];let rest=text.trim();
      while(rest.length>150){
        const prefix=rest.slice(0,150),sentence=Math.max(prefix.lastIndexOf('. '),prefix.lastIndexOf('! '),prefix.lastIndexOf('? '));
        const space=prefix.lastIndexOf(' '),cut=sentence>45?sentence+1:space>45?space:150;
        parts.push(rest.slice(0,cut));rest=rest.slice(cut).trim();
      }
      if(rest)parts.push(rest);return parts;
    }
    function read(payload){
      cancel();refresh();
      const selected=voice();
      if(!selected){announce('Instale uma voz de português nas configurações de fala do aparelho e recarregue a página. A conversa continua por texto.');return false}
      const text=typeof payload?.text==='string'?payload.text.trim().slice(0,360):'';
      if(!text)return false;
      const sequence=token;let started=false;
      const finish=(notice)=>{
        if(token!==sequence)return;
        cancel();announce(notice);
      };
      try{
        utterances=chunks(text).map(part=>{
          const utterance=new SpeechSynthesisUtterance(part);utterance.voice=selected;utterance.lang=selected.lang;
          utterance.rate=1.02;utterance.pitch=1;utterance.volume=1;
          utterance.onstart=()=>{
            if(token!==sequence)return;
            clearTimeout(startTimer);
            if(!started){started=true;announce('O bacano está falando · '+selected.name);onStart(payload)}
          };
          utterance.onerror=event=>{
            if(token!==sequence)return;
            finish(event.error==='not-allowed'?'O navegador bloqueou a leitura. Toque em “ouvir novamente” para liberar o som.':'Não consegui reproduzir essa voz. Escolha outra voz local ou confira o áudio do aparelho.');
          };
          return utterance;
        });
        utterances[utterances.length-1].onend=()=>finish('Leitura concluída.');
        speaking=true;controls();announce('Preparando a leitura…');
        startTimer=setTimeout(()=>finish('A leitura não começou. Toque em “ouvir novamente” e confira o volume do aparelho.'),8000);
        endTimer=setTimeout(()=>finish('Leitura interrompida. Você pode ouvir novamente.'),60000);
        // Mantém as referências e enfileira trechos curtos para motores de voz
        // que interrompem frases longas. Tudo é iniciado pela mesma interação.
        synth.resume();for(const utterance of utterances)synth.speak(utterance);
        return true;
      }catch{finish('A voz não está disponível agora. A conversa continua por texto.');return false}
    }
    toggle.onclick=()=>{
      if(enabled){enabled=false;cancel();announce('Voz desativada.');return}
      refresh();if(!voice()){announce('Seu navegador não encontrou uma voz local em português. Instale-a nas configurações de fala do aparelho e recarregue.');return}
      enabled=true;controls();read(last||{text:'Voz ativada, calabreso.'});
    };
    replay.onclick=()=>{if(last)read(last)};
    stopButton.onclick=()=>{cancel();announce('Leitura parada.')};
    select.onchange=()=>{cancel();announce('Voz selecionada. Toque em “ouvir novamente” para escutar.')};
    if(supported){
      synth.addEventListener?.('voiceschanged',refresh);refresh();
      announce('Ative para ouvir com uma voz local do aparelho, sem API de voz paga.');
    }else{
      controls();announce('Este navegador não oferece leitura por voz. A conversa continua por texto.');
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&speaking){cancel();announce('Leitura pausada ao sair da tela. Toque em “ouvir novamente” para recomeçar.')}});
    return {
      setResponse(payload){last={text:payload.text,gesture:payload.gesture};controls();if(enabled&&!document.hidden)read(last)},
      stop(){if(speaking){cancel();announce('Leitura parada.')}},
      clear(){cancel();last=null;controls();if(supported)announce(enabled?'Voz ativada para as próximas respostas.':'Ative para ouvir as respostas.')}
    };
  }};
})();
