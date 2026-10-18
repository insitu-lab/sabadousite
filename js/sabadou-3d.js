import * as THREE from '../vendor/three/build/three.module.js';
import {FBXLoader} from '../vendor/three/examples/jsm/loaders/FBXLoader.js';
import {OrbitControls} from '../vendor/three/examples/jsm/controls/OrbitControls.js';

let started=false;
export async function start(){
  if(started)return;
  const viewport=document.getElementById('model-viewport'),status=document.getElementById('model-status');
  const buttons=[...document.querySelectorAll('[data-motion]')],pause=document.getElementById('model-pause'),cameraButton=document.getElementById('model-camera'),speed=document.getElementById('model-speed');
  const assetRoot=new URL('../assets/3d/vilao/',import.meta.url);
  const motions={idle:{file:'Idle.fbx',label:'parado'},walk:{file:'Walking.fbx',label:'andando'},attack:{file:'Zombie Attack.fbx',label:'reagindo',once:true},fall:{file:'Two Handed Sword Death.fbx',label:'caindo',once:true}};
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
  const loader=new FBXLoader(),cache=new Map();let model=null,mixer=null,current=null,currentId='idle',busy=false,paused=false,disposed=false;
  function disposeModel(object){
    const textures=new Set();object.traverse(node=>{
      node.geometry?.dispose();for(const material of [].concat(node.material||[])){
        for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
        material.dispose();
      }
    });textures.forEach(texture=>texture.dispose());
  }
  function clipFor(object){
    const original=object.animations?.[0];if(!original)throw new Error('O arquivo não contém animação.');
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
    const motion=motions[id];status.textContent='Carregando animação: '+motion.label+'…';
    const object=await loader.loadAsync(new URL(motion.file,assetRoot).href,event=>{
      if(event.lengthComputable)status.textContent='Carregando '+motion.label+' · '+Math.round(event.loaded/event.total*100)+'%';
    });
    try{const clip=clipFor(object);cache.set(id,clip);return clip}finally{disposeModel(object)}
  }
  async function select(id){
    if(busy||!model)return;
    lock(true);
    try{
      const clip=await load(id),next=mixer.clipAction(clip);next.reset();next.enabled=true;next.clampWhenFinished=!!motions[id].once;
      next.setLoop(motions[id].once?THREE.LoopOnce:THREE.LoopRepeat,motions[id].once?1:Infinity);
      next.setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if(current&&current!==next){next.crossFadeFrom(current,.25,false)}
      current=next;currentId=id;paused=false;pause.textContent='pausar';mixer.timeScale=Number(speed.value);
      buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.motion===id)));
      status.textContent='Animação: '+motions[id].label+'.';
    }catch(error){console.error('Falha na animação 3D.',error);status.textContent='Não consegui abrir essa animação. Tente novamente.'}
    finally{lock(false)}
  }
  try{
    status.textContent='Carregando personagem…';
    model=await loader.loadAsync(new URL(motions.idle.file,assetRoot).href,event=>{
      if(event.lengthComputable)status.textContent='Carregando personagem · '+Math.round(event.loaded/event.total*100)+'%';
    });
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('O modelo não tem dimensões válidas.');
    const scale=2.4/size.y;stage.scale.setScalar(scale);stage.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);stage.add(model);
    mixer=new THREE.AnimationMixer(model);cache.set('idle',clipFor(model));
    document.getElementById('model-welcome').hidden=true;document.getElementById('model-label').hidden=false;
    viewport.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Personagem 3D. Use os botões para escolher uma animação.');
    const resize=()=>{const width=viewport.clientWidth,height=viewport.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()};
    const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
    let previous=performance.now();const draw=now=>{const dt=Math.max(0,Math.min((now-previous)/1000,.05));previous=now;if(document.hidden||disposed)return;mixer.update(dt);controls.update();renderer.render(scene,camera)};renderer.setAnimationLoop(draw);
    buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.motion)));
    pause.onclick=()=>{paused=!paused;mixer.timeScale=paused?0:Number(speed.value);pause.textContent=paused?'continuar':'pausar'};
    speed.onchange=()=>{if(!paused)mixer.timeScale=Number(speed.value)};cameraButton.onclick=cameraHome;
    const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let down=null;
    renderer.domElement.addEventListener('pointerdown',event=>{down=[event.clientX,event.clientY]});
    renderer.domElement.addEventListener('pointerup',event=>{
      if(!down||Math.hypot(event.clientX-down[0],event.clientY-down[1])>7)return;down=null;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      if(raycaster.intersectObject(model,true).length)select(currentId==='attack'?'idle':'attack');
    });
    renderer.domElement.addEventListener('webglcontextlost',()=>{status.textContent='A renderização foi interrompida. Recarregue a página para abrir novamente.';lock(true)});
    addEventListener('pagehide',event=>{renderer.setAnimationLoop(null);if(event.persisted)return;disposed=true;observer.disconnect();controls.dispose();renderer.dispose();disposeModel(model)});
    addEventListener('pageshow',event=>{if(event.persisted&&!disposed){previous=performance.now();resize();renderer.setAnimationLoop(draw)}});
    started=true;await select('idle');
  }catch(error){renderer.dispose();controls.dispose();if(model)disposeModel(model);throw error}
}
