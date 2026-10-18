import * as THREE from '../vendor/three/build/three.module.js';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from '../vendor/three/examples/jsm/loaders/DRACOLoader.js';
import {OrbitControls} from '../vendor/three/examples/jsm/controls/OrbitControls.js';
import {GESTURES,createGestureFactory} from './sabadou-character-gestures.js?v=build-20261018195326-25547941';

let started=false;
export async function start(){
  if(started)return;
  const viewport=document.getElementById('model-viewport'),status=document.getElementById('model-status');
  const assetRoot=new URL('../assets/3d/bacano/web/',import.meta.url);
  const modelUrl=new URL('bacano-articulado.glb',assetRoot);
  const build=document.querySelector('meta[name="sabadou-build"]')?.content;if(build)modelUrl.searchParams.set('v',build);
  const motions={idle:{label:'em repouso'},...GESTURES};
  const expressiveIds=new Set(['idle',...Object.keys(GESTURES)]);
  const bubble=document.getElementById('character-expression'),bubbleText=document.getElementById('character-expression-text');
  let expressionEpoch=0,returnTimer=null,characterApi=null;
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'})}
  catch(cause){throw Object.assign(new Error('Não foi possível iniciar a renderização WebGL 2 neste navegador.',{cause}),{code:'renderer'})}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,100);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.53;
  let fitDistance=4.5;
  const cameraHome=()=>{camera.position.set(0,1.35+fitDistance*.1,fitDistance);controls.target.set(0,1.2,0);controls.update()};cameraHome();
  scene.add(new THREE.HemisphereLight(0xf4ddff,0x443050,3));
  const key=new THREE.DirectionalLight(0xfff0ff,3);key.position.set(3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0xc07aff,3);rim.position.set(-3,3,-3);scene.add(rim);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(1.45,64),new THREE.MeshStandardMaterial({color:0x371650,roughness:.9,transparent:true,opacity:.55}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
  const stage=new THREE.Group();scene.add(stage);
  const draco=new DRACOLoader();draco.setDecoderPath(new URL('../vendor/three/examples/jsm/libs/draco/gltf/',import.meta.url).href);draco.setWorkerLimit(1);
  const loader=new GLTFLoader().setDRACOLoader(draco),cache=new Map();let model=null,mixer=null,current=null,currentId='idle',busy=false,disposed=false,makeGesture=null;
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
  function lock(value){busy=value}
  async function load(id){
    if(cache.has(id)){
      const clip=cache.get(id);cache.delete(id);cache.set(id,clip);return clip;
    }
    if(makeGesture&&Object.hasOwn(GESTURES,id)){
      const clip=makeGesture(id);cache.set(id,clip);
      // Mantém somente as expressões recentes e o Idle, sem gerar 50 clipes na abertura.
      for(const [key,old] of cache){
        if(cache.size<=10)break;
        if(key==='idle'||key===currentId||key===id)continue;
        mixer.existingAction(old)?.stop();mixer.uncacheClip(old);cache.delete(key);
      }
      return clip;
    }
    throw new Error('A animação não está disponível neste modelo.');
  }
  async function select(id){
    if(busy||!model||!Object.hasOwn(motions,id))return false;
    lock(true);
    try{
      const clip=await load(id),next=mixer.clipAction(clip);next.reset();next.enabled=true;next.clampWhenFinished=!!motions[id].once;
      next.setLoop(motions[id].once?THREE.LoopOnce:THREE.LoopRepeat,motions[id].once?1:Infinity);
      next.setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if(current&&current!==next){next.crossFadeFrom(current,.55,false)}
      current=next;currentId=id;mixer.timeScale=1;
      status.textContent='O bacano está '+motions[id].label+'.';
      return true;
    }catch(error){console.error('Falha na animação 3D.',error);status.textContent='Não consegui abrir essa animação. Tente novamente.';return false}
    finally{lock(false)}
  }
  async function express(payload={}){
    if(!payload||typeof payload!=='object'||disposed||busy)return false;
    const id=expressiveIds.has(payload.gesture)?payload.gesture:expressiveIds.has('talk')?'talk':'idle',epoch=++expressionEpoch;
    clearTimeout(returnTimer);
    const text=typeof payload.text==='string'?payload.text.trim().slice(0,360):'';
    if(!await select(id)||epoch!==expressionEpoch)return false;
    bubbleText.textContent=text;bubble.hidden=!text;
    if(motions[id].loop&&text){
      const requested=Number(payload.durationMs),duration=Number.isFinite(requested)?requested:Math.max(3000,text.length*55);
      returnTimer=setTimeout(()=>{if(epoch===expressionEpoch&&!disposed)select('idle')},THREE.MathUtils.clamp(duration,1000,15000));
    }
    return true;
  }
  const onExpression=event=>{express(event.detail).catch(error=>console.warn('Expressão não aplicada.',error))};
  try{
    status.textContent='Carregando personagem…';
    const asset=await loader.loadAsync(modelUrl.href,event=>{
      if(event.lengthComputable)status.textContent='Carregando personagem · '+Math.round(event.loaded/event.total*100)+'%';
    }).catch(cause=>{throw Object.assign(new Error('Não foi possível carregar o arquivo 3D. Confira se assets/3d/bacano/web e vendor/three foram publicados por completo.',{cause}),{code:'model'})});
    model=asset.scene;
    cache.set('idle',clipFor(asset.animations.find(clip=>clip.name==='idle')));
    // A malha articulada muda de posição ao aplicar o Idle. Meça os vértices
    // nessa pose, não a caixa de referência anterior à animação.
    stage.add(model);mixer=new THREE.AnimationMixer(model);
    mixer.clipAction(cache.get('idle')).play();mixer.update(0);model.updateWorldMatrix(true,true);
    const bounds=new THREE.Box3().setFromObject(model,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('O modelo não tem dimensões válidas.');
    const scale=2.4/size.y;stage.scale.setScalar(scale);stage.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);stage.updateMatrixWorld(true);
    try{
      makeGesture=createGestureFactory(model,cache.get('idle'));
    }catch(error){
      console.warn('O personagem abriu, mas as expressões não puderam ser preparadas.',error);
      const warning=document.getElementById('model-warning');
      warning.textContent='O personagem está disponível em repouso. As expressões não puderam ser preparadas para este esqueleto.';warning.hidden=false;
      for(const id of Object.keys(GESTURES))expressiveIds.delete(id);
    }
    mixer.stopAllAction();
    mixer.addEventListener('finished',event=>{
      const id=currentId;
      if(event.action===current&&motions[id].returnToIdle)setTimeout(()=>{if(!disposed&&currentId===id&&!busy)select('idle')},0);
    });
    document.getElementById('model-welcome').hidden=true;document.getElementById('model-label').hidden=false;
    viewport.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Personagem 3D. As expressões acompanham a conversa com a IA. Arraste para girar a visão.');
    let firstSize=true;
    const resize=()=>{
      const width=Math.max(1,viewport.clientWidth),height=Math.max(1,viewport.clientHeight);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
      const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
      const previousFit=fitDistance;
      fitDistance=Math.max(3.6,1.4/Math.tan(halfFov),(size.x*scale*.65)/Math.tan(halfFov)/camera.aspect);
      if(firstSize||Math.abs(fitDistance-previousFit)>.1){cameraHome();firstSize=false}
    };
    const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
    let previous=performance.now();const draw=now=>{const dt=Math.max(0,Math.min((now-previous)/1000,.05));previous=now;if(document.hidden||disposed)return;mixer.update(dt);controls.update();renderer.render(scene,camera)};renderer.setAnimationLoop(draw);
    started=true;await select('idle');
    characterApi={ready:true,express,stop:()=>express({gesture:'idle',text:''}),gestures:[...expressiveIds]};
    window.SabadouCharacter=characterApi;addEventListener('sabadou:character-expression',onExpression);
    dispatchEvent(new CustomEvent('sabadou:character-ready'));
    renderer.domElement.addEventListener('webglcontextlost',()=>{status.textContent='A renderização foi interrompida. Recarregue a página para abrir novamente.';lock(true)});
    addEventListener('pagehide',event=>{renderer.setAnimationLoop(null);if(event.persisted)return;disposed=true;clearTimeout(returnTimer);removeEventListener('sabadou:character-expression',onExpression);if(window.SabadouCharacter===characterApi)delete window.SabadouCharacter;observer.disconnect();controls.dispose();renderer.dispose();draco.dispose();disposeModel(model)});
    addEventListener('pageshow',event=>{if(event.persisted&&!disposed){previous=performance.now();resize();renderer.setAnimationLoop(draw)}});
  }catch(error){renderer.dispose();controls.dispose();draco.dispose();if(model)disposeModel(model);throw error}
}
