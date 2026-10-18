/* Dados de articulação e aproximação da fala. Nenhum comando da IA é executado. */
import * as THREE from '../vendor/three/build/three.module.js';

export function createCharacterMotion(model){
  const limits=window.SabadouRig||{},bones=[],mouths=[];
  const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
  model.traverse(node=>{
    if(node.isBone)bones.push(node);
    if(node.isMesh&&node.morphTargetInfluences&&Object.hasOwn(node.morphTargetDictionary||{},'mouthOpen')){
      mouths.push({mesh:node,open:node.morphTargetDictionary.mouthOpen,round:node.morphTargetDictionary.mouthRound});
    }
  });
  const joints=new Map(Object.keys(limits).map(name=>[name,bones.find(bone=>normalize(bone.name).endsWith(normalize(name)))]));
  const offsets=new Map([...joints.keys()].map(name=>[name,new THREE.Quaternion()]));
  let tracks=new Map(),face={mouthOpen:0,mouthRound:0},bodyWeight=0,profileAt=0,profileUntil=0;
  let speaking=false,paused=false,text='',anchor=0,anchorAt=0,segmentEnd=0,jaw=0,round=0;
  const identity=new THREE.Quaternion(),offset=new THREE.Quaternion(),goal=new THREE.Quaternion();
  const clamp=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)?THREE.MathUtils.clamp(value,min,max):0;
  function setProfile(payload={}){
    tracks=new Map();profileAt=performance.now();profileUntil=profileAt+Math.min(20000,Math.max(3500,(payload.text?.length||0)*70));
    for(const move of Array.isArray(payload.moves)?payload.moves.slice(0,16):[]){
      if(!move||!Object.hasOwn(limits,move.joint)||!joints.get(move.joint))continue;
      const bound=limits[move.joint],entry={at:clamp(move.at,0,1),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(clamp(move.x,-bound[0],bound[0])),THREE.MathUtils.degToRad(clamp(move.y,-bound[1],bound[1])),
        THREE.MathUtils.degToRad(clamp(move.z,-bound[2],bound[2]))))};
      if(!tracks.has(move.joint))tracks.set(move.joint,[]);
      const list=tracks.get(move.joint),existing=list.findIndex(frame=>Math.abs(frame.at-entry.at)<.001);
      if(existing>=0)list[existing]=entry;else list.push(entry);
    }
    for(const list of tracks.values())list.sort((a,b)=>a.at-b.at);
    face={mouthOpen:clamp(payload.face?.mouthOpen,0,.3),mouthRound:clamp(payload.face?.mouthRound,0,.65)};
  }
  function sample(list,phase){
    if(list.length===1)return offset.copy(list[0].q);
    let a=list[list.length-1],b=list[0],start=a.at,end=b.at+1,p=phase;
    for(let i=0;i<list.length-1;i++)if(phase>=list[i].at&&phase<list[i+1].at){a=list[i];b=list[i+1];start=a.at;end=b.at;break}
    if(p<start)p+=1;
    const t=THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((p-start)/Math.max(.001,end-start),0,1),0,1);
    return offset.copy(a.q).slerp(b.q,t);
  }
  function chunk(info={}){
    anchor=clamp(info.charIndex,0,text.length);anchorAt=performance.now();
    segmentEnd=Math.min(text.length,anchor+(typeof info.text==='string'?info.text.length:text.length-anchor));
    paused=false;
  }
  function boundary(info={}){
    if(!speaking)return;anchor=clamp(info.charIndex,0,text.length);anchorAt=performance.now();
  }
  function soundShape(character){
    const letter=character.toLowerCase();
    if(!letter||/[\s.,!?;:…]/u.test(letter))return [0,0];
    if(/[mbp]/u.test(letter))return [.015,.05];
    if(/[aáàâã]/u.test(letter))return [.73,.08];
    if(/[eéêií]/u.test(letter))return [.44,.05];
    if(/[oóôõuú]/u.test(letter))return [.56,.72];
    return [.28,.18];
  }
  function update(now,dt){
    const active=speaking||now<profileUntil;
    bodyWeight+=(Number(active)-bodyWeight)*(1-Math.exp(-dt*7));
    const phase=((now-profileAt)/5600)%1;
    for(const [name,bone] of joints){
      if(!bone)continue;
      const list=tracks.get(name);goal.copy(identity);
      if(list&&bodyWeight>.001)goal.slerp(sample(list,phase),bodyWeight);
      const current=offsets.get(name);current.slerp(goal,1-Math.exp(-dt*10));bone.quaternion.multiply(current);
    }
    let targetJaw=active?face.mouthOpen:0,targetRound=active?face.mouthRound:0;
    if(speaking&&!paused){
      // Eventos de palavra corrigem o relógio. Sem eles, estima letras por
      // segundo; não há acesso à onda de áudio ou alinhamento por fonemas.
      const cursor=anchor+(now-anchorAt)/1000*13.5,index=Math.floor(cursor);
      if(index<segmentEnd){
        const a=soundShape(text[index]||''),b=soundShape(text[index+1]||''),mix=cursor-index;
        targetJaw=Math.max(targetJaw,a[0]*(1-mix)+b[0]*mix);targetRound=Math.max(targetRound,a[1]*(1-mix)+b[1]*mix);
      }else{
        targetJaw=Math.max(targetJaw,.18+.33*(.5+.5*Math.sin(now*.031)));
      }
    }else if(paused){targetJaw=0;targetRound=0}
    jaw+=(targetJaw-jaw)*(1-Math.exp(-dt*25));round+=(targetRound-round)*(1-Math.exp(-dt*18));
    for(const mouth of mouths){
      mouth.mesh.morphTargetInfluences[mouth.open]=THREE.MathUtils.clamp(jaw,0,.85);
      if(Number.isInteger(mouth.round))mouth.mesh.morphTargetInfluences[mouth.round]=THREE.MathUtils.clamp(round,0,.8);
    }
  }
  function endSpeech(){speaking=false;paused=false;profileUntil=0;face={mouthOpen:0,mouthRound:0}}
  return {
    hasMouth:mouths.length>0,setProfile,update,chunk,boundary,
    beginSpeech(payload={}){setProfile(payload);speaking=true;paused=false;text=String(payload.text||'').slice(0,360);chunk({charIndex:0,text})},
    pause(value){paused=!!value;if(!paused)anchorAt=performance.now()},
    endSpeech,
    reset(){endSpeech();tracks=new Map();bodyWeight=0;jaw=round=0;for(const q of offsets.values())q.identity();for(const mouth of mouths){mouth.mesh.morphTargetInfluences[mouth.open]=0;if(Number.isInteger(mouth.round))mouth.mesh.morphTargetInfluences[mouth.round]=0}}
  };
}
