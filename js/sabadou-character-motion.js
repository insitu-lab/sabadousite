/* Dados de articulação e aproximação da fala. Nenhum comando da IA é executado. */
import * as THREE from '../vendor/three/build/three.module.js';
import {createBodyController} from './sabadou-character-body.js?v=build-20261018210158-916d2855';

export function createCharacterMotion(model){
  const body=createBodyController(model),mouths=[];
  model.traverse(node=>{
    if(node.isMesh&&node.morphTargetInfluences&&Object.hasOwn(node.morphTargetDictionary||{},'mouthOpen')){
      mouths.push({mesh:node,open:node.morphTargetDictionary.mouthOpen,round:node.morphTargetDictionary.mouthRound});
    }
  });
  let face={mouthOpen:0,mouthRound:0},profileUntil=0;
  let speaking=false,paused=false,text='',anchor=0,anchorAt=0,segmentEnd=0,jaw=0,round=0;
  const clamp=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)?THREE.MathUtils.clamp(value,min,max):0;
  function setProfile(payload={}){
    body.setProfile(payload);profileUntil=performance.now()+Math.min(20000,Math.max(3500,(payload.text?.length||0)*70));
    face={mouthOpen:clamp(payload.face?.mouthOpen,0,.3),mouthRound:clamp(payload.face?.mouthRound,0,.65)};
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
    body.update(now,dt);
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
  function endSpeech(){speaking=false;paused=false;profileUntil=0;body.speak(false);face={mouthOpen:0,mouthRound:0}}
  return {
    hasMouth:mouths.length>0,hasFingers:body.hasFingers,get customBody(){return body.custom},
    setProfile,update,chunk,boundary,beforeUpdate:body.beforeUpdate,think:body.think,gaze:body.gaze,
    beginSpeech(payload={}){setProfile(payload);body.speak(true);speaking=true;paused=false;text=String(payload.text||'').slice(0,360);chunk({charIndex:0,text})},
    pause(value){paused=!!value;if(!paused)anchorAt=performance.now()},
    endSpeech,
    reset(){endSpeech();body.reset();jaw=round=0;for(const mouth of mouths){mouth.mesh.morphTargetInfluences[mouth.open]=0;if(Number.isInteger(mouth.round))mouth.mesh.morphTargetInfluences[mouth.round]=0}}
  };
}
