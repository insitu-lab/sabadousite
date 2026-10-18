import * as THREE from '../vendor/three/build/three.module.js';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from '../vendor/three/examples/jsm/loaders/DRACOLoader.js';
import {OrbitControls} from '../vendor/three/examples/jsm/controls/OrbitControls.js';
import {GESTURES,createGestures} from './sabadou-character-gestures.js?v=build-20261018162943-c5e591e3';

let started=false;
export async function start(){
  if(started)return;
  const viewport=document.getElementById('model-viewport'),status=document.getElementById('model-status');
  const buttons=[...document.querySelectorAll('[data-motion]')],pause=document.getElementById('model-pause'),cameraButton=document.getElementById('model-camera'),speed=document.getElementById('model-speed');
  const assetRoot=new URL('../assets/3d/vilao/web/',import.meta.url);
  const modelUrl=new URL('bacano-animado.glb',assetRoot);
  const build=document.querySelector('meta[name="sabadou-build"]')?.content;if(build)modelUrl.searchParams.set('v',build);
  const motions={idle:{label:'parado'},walk:{label:'andando'},attack:{label:'reagindo',once:true},fall:{label:'caindo',once:true},...GESTURES};
  const expressiveIds=new Set(['idle',...Object.keys(GESTURES)]);
  const bubble=document.getElementById('character-expression'),bubbleText=document.getElementById('character-expression-text');
  const examples={talk:'Calabreso, você pode enviar sua fanart pelo site e acompanhar o resultado!',point:'Olha ali: escolha uma animação nos botões abaixo.',wave:'E aí, calabreso! Seja bem-vindo ao Sabadou.',think:'Hmm… deixa eu pensar numa ideia bacana para a sua fanart.',yes:'Isso mesmo, calabreso! Você entendeu direitinho.',celebrate:'Aí sim! Mais uma conquista para os calabresos!'};
  let expressionEpoch=0,returnTimer=null,characterApi=null;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,100);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.53;
  const cameraHome=()=>{camera.position.set(0,1.6,4.5);controls.target.set(0,1.15,0);controls.update()};cameraHome();
  scene.add(new THREE.HemisphereLight(0xf4ddff,0x443050,3));
  const key=new THREE.DirectionalLight(0xfff0ff,3);key.position.set(3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0xc07aff,3);rim.position.set(-3,3,-3);scene.add(rim);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(1.45,64),new THREE.MeshStandardMaterial({color:0x371650,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
  const stage=new THREE.Group();scene.add(stage);
  const draco=new DRACOLoader();draco.setDecoderPath(new URL('../vendor/three/examples/jsm/libs/draco/gltf/',import.meta.url).href);draco.setWorkerLimit(1);
  const loader=new GLTFLoader().setDRACOLoader(draco),cache=new Map();let model=null,mixer=null,current=null,currentId='idle',busy=false,paused=false,disposed=false;
  function disposeModel(object){
    const textures=new Set();object.traverse(node=>{
      node.geometry?.dispose();for(const material of [].concat(node.material||[])){
        for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
        material.dispose();
      }
    });textures.forEach(texture=>{texture.source?.data?.close?.();texture.dispose()});
  }
  function clipFor(original){
    if(!original)throw new Error('O arquivo não contém a animação esperada.');
    const clip=original.clone();
    for(const track of clip.tracks){
      // Mantém o personagem no palco sem remover a altura das passadas/quedas.
      if(/Hips\.position$/.test(track.name))for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2]}
    }
    return clip;
  }
  function lock(value){busy=value;buttons.forEach(button=>button.disabled=value);pause.disabled=value;cameraButton.disabled=value;speed.disabled=value}
  async function load(id){
    if(cache.has(id))return cache.get(id);
    throw new Error('A animação não está disponível neste modelo.');
  }
  async function select(id){
    if(busy||!model||!Object.hasOwn(motions,id))return false;
    lock(true);
    try{
      const clip=await load(id),next=mixer.clipAction(clip);next.reset();next.enabled=true;next.clampWhenFinished=!!motions[id].once;
      next.setLoop(motions[id].once?THREE.LoopOnce:THREE.LoopRepeat,motions[id].once?1:Infinity);
      next.setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if(current&&current!==next){next.crossFadeFrom(current,.25,false)}
      current=next;currentId=id;paused=false;pause.textContent='pausar';mixer.timeScale=Number(speed.value);
      buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.motion===id)));
      status.textContent='Animação: '+motions[id].label+'.';
      return true;
    }catch(error){console.error('Falha na animação 3D.',error);status.textContent='Não consegui abrir essa animação. Tente novamente.';return false}
    finally{lock(false)}
  }
  async function express(payload={}){
    if(!payload||typeof payload!=='object'||disposed||busy)return false;
    const id=expressiveIds.has(payload.gesture)?payload.gesture:'talk',epoch=++expressionEpoch;
    clearTimeout(returnTimer);
    const text=typeof payload.text==='string'?payload.text.trim().slice(0,360):'';
    if(!await select(id)||epoch!==expressionEpoch)return false;
    bubbleText.textContent=text;bubble.hidden=!text;
    if(id==='talk'&&text){
      const requested=Number(payload.durationMs),duration=Number.isFinite(requested)?requested:Math.max(3000,text.length*55);
      returnTimer=setTimeout(()=>{if(epoch===expressionEpoch&&!disposed)select('idle')},THREE.MathUtils.clamp(duration,1000,15000));
    }
    return true;
  }
  const choose=id=>{
    if(expressiveIds.has(id))return express({gesture:id,text:examples[id]||''});
    expressionEpoch++;clearTimeout(returnTimer);bubble.hidden=true;bubbleText.textContent='';return select(id);
  };
  const onExpression=event=>{express(event.detail).catch(error=>console.warn('Expressão não aplicada.',error))};
  try{
    status.textContent='Carregando personagem…';
    const asset=await loader.loadAsync(modelUrl.href,event=>{
      if(event.lengthComputable)status.textContent='Carregando personagem · '+Math.round(event.loaded/event.total*100)+'%';
    });
    model=asset.scene;
    for(const id of ['idle','walk','attack','fall'])cache.set(id,clipFor(asset.animations.find(clip=>clip.name===id)));
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('O modelo não tem dimensões válidas.');
    const scale=2.4/size.y;stage.scale.setScalar(scale);stage.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);stage.add(model);
    mixer=new THREE.AnimationMixer(model);
    mixer.clipAction(cache.get('idle')).play();mixer.update(0);model.updateWorldMatrix(true,true);
    for(const [id,clip] of createGestures(model,cache.get('idle')))cache.set(id,clip);
    mixer.stopAllAction();
    mixer.addEventListener('finished',event=>{
      const id=currentId;
      if(event.action===current&&motions[id].returnToIdle)setTimeout(()=>{if(!disposed&&currentId===id&&!busy)select('idle')},0);
    });
    document.getElementById('model-welcome').hidden=true;document.getElementById('model-label').hidden=false;
    viewport.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Personagem 3D. Use os botões para escolher uma animação.');
    const resize=()=>{const width=viewport.clientWidth,height=viewport.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()};
    const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
    let previous=performance.now();const draw=now=>{const dt=Math.max(0,Math.min((now-previous)/1000,.05));previous=now;if(document.hidden||disposed)return;mixer.update(dt);controls.update();renderer.render(scene,camera)};renderer.setAnimationLoop(draw);
    buttons.forEach(button=>button.addEventListener('click',()=>choose(button.dataset.motion)));
    characterApi={ready:true,express,stop:()=>choose('idle'),gestures:[...expressiveIds]};
    window.SabadouCharacter=characterApi;addEventListener('sabadou:character-expression',onExpression);
    dispatchEvent(new CustomEvent('sabadou:character-ready'));
    pause.onclick=()=>{paused=!paused;mixer.timeScale=paused?0:Number(speed.value);pause.textContent=paused?'continuar':'pausar'};
    speed.onchange=()=>{if(!paused)mixer.timeScale=Number(speed.value)};cameraButton.onclick=cameraHome;
    const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let down=null;
    renderer.domElement.addEventListener('pointerdown',event=>{down=[event.clientX,event.clientY]});
    renderer.domElement.addEventListener('pointerup',event=>{
      if(!down||Math.hypot(event.clientX-down[0],event.clientY-down[1])>7)return;down=null;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      if(raycaster.intersectObject(model,true).length)choose(currentId==='wave'?'idle':'wave');
    });
    renderer.domElement.addEventListener('webglcontextlost',()=>{status.textContent='A renderização foi interrompida. Recarregue a página para abrir novamente.';lock(true)});
    addEventListener('pagehide',event=>{renderer.setAnimationLoop(null);if(event.persisted)return;disposed=true;clearTimeout(returnTimer);removeEventListener('sabadou:character-expression',onExpression);if(window.SabadouCharacter===characterApi)delete window.SabadouCharacter;observer.disconnect();controls.dispose();renderer.dispose();draco.dispose();disposeModel(model)});
    addEventListener('pageshow',event=>{if(event.persisted&&!disposed){previous=performance.now();resize();renderer.setAnimationLoop(draw)}});
    started=true;await select('idle');
  }catch(error){renderer.dispose();controls.dispose();draco.dispose();if(model)disposeModel(model);throw error}
}
