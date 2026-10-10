/* Cadastro antecipado exclusivo da manutenção do site oficial. */
(()=>{
  const packaged=document.documentElement.dataset.packageSite;
  if(packaged&&packaged!=='oficial')return;
  if(!packaged&&window.SabadouSiteLinks?.version!=='oficial')return;
  const instagram=document.getElementById('ig');if(!instagram)return;
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';
  stylesheet.href='css/sabadou-early-access.css?v=20261010-1-publicacao-20261009';document.head.append(stylesheet);
  const panel=document.createElement('section');panel.className='early-access';panel.id='early-access';
  panel.setAttribute('aria-labelledby','early-title');
  panel.innerHTML=`<div id="early-invite">
    <span class="early-badge">🐸 calabreso antecipado</span>
    <h2 id="early-title">Seu próximo sábado começa aqui.</h2>
    <p>Crie sua conta enquanto o Sabadou prepara a casa. Quando o site abrir, seu login já vai estar pronto!</p>
    <div class="early-actions"><button class="cta" id="early-create" type="button">fazer meu login antecipado</button><button class="early-link" id="early-signin" type="button">já tenho conta</button></div>
    <p class="early-note">Cadastro gratuito. Use o mesmo @ e senha quando a atualização chegar.</p>
  </div>
  <div id="early-ready" hidden>
    <span class="early-badge">💜 conta pronta para a estreia</span>
    <h2 id="early-ready-title">Seu login está pronto!</h2>
    <p><strong id="early-handle"></strong> você se antecipou à abertura. Agora é só esperar o próximo sábado do site!</p>
    <div class="early-progress" role="progressbar" aria-label="Preparação da sua conta concluída" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span></span></div>
    <p class="early-complete">100% pronto para a estreia</p>
    <div class="early-reminder"><b>🔐 Lembre da sua senha!</b><p>Guarde seu @ e sua senha em um lugar seguro. Você vai usar os mesmos dados para entrar quando o site voltar.</p></div>
    <p class="early-note">Sua conta está pronta. O site continua em manutenção até a abertura.</p>
    <button class="early-link" id="early-switch" type="button">trocar de conta</button>
  </div>
  <p class="early-status" id="early-status" role="status" aria-live="polite"></p>`;
  instagram.before(panel);
  const dialog=document.createElement('dialog');dialog.id='ul';dialog.className='early-auth';
  dialog.setAttribute('aria-labelledby','ut');
  dialog.innerHTML=`<form id="ulf">
    <span class="early-badge">💜 prepare seu login</span><h3 id="ut">criar conta</h3>
    <label for="uh">Seu @ do Instagram</label><input class="fld" id="uh" placeholder="nome do Instagram (sem @)" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="30">
    <label for="upw">Sua senha do site</label><input class="fld" id="upw" type="password" placeholder="senha nova, diferente da senha do Instagram" autocomplete="new-password" required maxlength="72">
    <p id="um" class="early-note" aria-live="polite"></p>
    <div class="early-auth-actions"><button class="cta" id="usubmit" type="submit">criar conta</button><button class="early-link" id="uswitch" type="button">já tenho conta</button><button class="early-link" id="early-close" type="button">fechar</button></div>
    <p class="early-legal">Conheça nossos <a href="termos.html?site=oficial" target="_blank" rel="noopener">termos de uso</a> e a <a href="privacy.html?site=oficial" target="_blank" rel="noopener">política de privacidade</a>.</p>
  </form>`;
  document.body.append(dialog);
  const find=id=>document.getElementById(id),status=find('early-status');
  let client=null,auth=null,boot=null,opening=false,celebrated=null;
  function signedOut(){find('early-ready').hidden=true;find('early-invite').hidden=false;find('early-handle').textContent=''}
  function ready(user,celebrate){
    const handle=user.user_metadata?.handle;
    find('early-handle').textContent=typeof handle==='string'&&/^[a-z0-9._]{1,30}$/i.test(handle)?'@'+handle+',':'';
    find('early-invite').hidden=true;find('early-ready').hidden=false;status.textContent='';
    if(celebrate&&celebrated!==user.id&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      celebrated=user.id;
      const burst=document.createElement('div');burst.className='early-burst';burst.setAttribute('aria-hidden','true');
      for(let i=0;i<12;i++){
        const spark=document.createElement('span');spark.textContent=['💜','✨','💖'][i%3];
        spark.style.setProperty('--spark-x',(8+i*7)+'%');spark.style.setProperty('--spark-delay',(i%4)*.08+'s');
        burst.append(spark);
      }
      panel.append(burst);setTimeout(()=>burst.remove(),2200);
    }
  }
  async function refresh(celebrate=false){
    const session=(await client.auth.getSession()).data.session;
    if(!session){signedOut();return false}
    // Confirma a conta no Auth; não considera o cache local um cadastro concluído.
    const result=await client.auth.getUser();
    if(result.error)throw result.error;
    const current=(await client.auth.getSession()).data.session;
    if(!current||current.user.id!==result.data.user?.id)return false;
    ready(result.data.user,celebrate);return true;
  }
  function loadAuth(){
    if(window.SabadouFanAuth)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const timer=setTimeout(()=>reject(new Error('Não foi possível carregar o formulário. Tente novamente.')),15000);
      script.src='js/sabadou-fan-auth.js?v=20261010-6-publicacao-20261009';
      script.onload=()=>{clearTimeout(timer);resolve()};
      script.onerror=()=>{clearTimeout(timer);reject(new Error('Não foi possível carregar o formulário. Confira a conexão.'))};
      document.head.append(script);
    });
  }
  function initialize(){
    if(boot)return boot;
    boot=(async()=>{
      const [instance]=await Promise.all([window.SabadouMaintenanceAuth.getClient(),loadAuth()]);client=instance;
      if(!auth){
        auth=window.SabadouFanAuth.mount({getClient:()=>client,copy:{
          createHint:'Crie uma senha nova para o Sabadou, diferente da senha do Instagram. Guarde seu @ e sua senha para a estreia.',
          signInHint:'Entre com o @ e a senha que você já usa no Sabadou. Sua conta também vale na atualização.'
        },onSignedIn:async()=>{
          if(!await refresh(true))throw new Error('Não foi possível confirmar a conta.');
          panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
        }});
        client.auth.onAuthStateChange(()=>setTimeout(()=>refresh().catch(()=>{
          signedOut();status.textContent='Entre novamente para confirmar seu login antecipado.';
        }),0));
      }
      await refresh().catch(()=>{signedOut();status.textContent='Entre para confirmar sua conta.'});
    })().catch(error=>{boot=null;throw error});
    return boot;
  }
  async function open(creating){
    if(opening)return;opening=true;status.textContent='Preparando seu login...';
    find('early-create').disabled=find('early-signin').disabled=true;
    try{await initialize();auth.mode(creating);auth.open();status.textContent=''}
    catch(error){status.textContent=error.message||'Não foi possível carregar o login. Tente novamente.'}
    finally{opening=false;find('early-create').disabled=find('early-signin').disabled=false}
  }
  find('early-create').onclick=()=>open(true);find('early-signin').onclick=()=>open(false);
  find('early-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{find('upw').value=''});
  find('early-switch').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      const result=await client.auth.signOut({scope:'local'});if(result.error)throw result.error;
      signedOut();celebrated=null;status.textContent='Você pode entrar com outra conta.';
    }catch{status.textContent='Não foi possível sair. Tente novamente.'}
    finally{button.disabled=false}
  };
  initialize().catch(error=>{status.textContent=error.message||'O login não carregou. Toque no botão para tentar novamente.'});
})();
