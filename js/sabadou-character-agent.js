/* Local perception/action loop for this virtual scene. No network or camera. */
import * as THREE from '../vendor/three/build/three.module.js';
import {WORLD_RULES} from './sabadou-character-world.js?v=build-20261018213433-731aa04e';

const KINDS=new Set(WORLD_RULES.actions);
const TARGETS=new Set(WORLD_RULES.targets);
const copyPoint=p=>p.toArray().map(n=>Math.round(n*100)/100);
export function createSceneAgent({scene,model,camera,onState=()=>{}}){
  const bones=[];model.traverse(node=>{if(node.isBone)bones.push(node)});
  const find=suffix=>bones.find(bone=>bone.name.endsWith(suffix));
  const hands={left:find('LeftHand'),right:find('RightHand')};
  const root=new THREE.Group();root.name='Ambiente_virtual_do_bacano';scene.add(root);
  const objects=new Map();
  function object(id,geometry,color,position,label){
    const material=new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.12,emissive:color,emissiveIntensity:.17});
    const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);root.add(mesh);
    objects.set(id,{mesh,home:position.clone(),label,heldBy:null});
  }
  object('orb',new THREE.SphereGeometry(.085,20,14),0xffbe64,new THREE.Vector3(-.63,1.16,.38),'bolinha dourada');
  object('crystal',new THREE.OctahedronGeometry(.10),0x8de7ff,new THREE.Vector3(.64,1.24,.33),'cristal azul');
  let queue=[],current=null,elapsed=0,nextIdle=4,enabled=true,busy=false,speaking=false,lastStatus='',lastTarget='',serial=0;
  let lastResult='ready',observations=[],control={},holdingSide=null,noticeUntil=0;
  const position=bone=>bone?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();
  const report=text=>{if(text!==lastStatus){lastStatus=text;onState(text)}};
  function target(id){
    if(objects.has(id))return objects.get(id).mesh.getWorldPosition(new THREE.Vector3());
    if(id==='left_hand'||id==='right_hand')return position(hands[id.split('_')[0]]);
    if(id==='floor')return new THREE.Vector3(0,.05,.55);
    if(id==='self')return position(find('Spine2'));
    return camera.position.clone();
  }
  function name(id){return objects.get(id)?.label||({left_hand:'mão esquerda',right_hand:'mão direita',viewer:'você',floor:'chão',self:'próprio corpo'}[id]||'ambiente')}
  function finish(result){
    if(current&&['not_reached','held','reached','completed'].includes(result)){
      const copy={not_reached:'Não alcancei esse alvo nesta tentativa.',held:'Consegui pegar '+name(current.target)+'.',reached:'Alcancei '+name(current.target)+'.',completed:'Movimento concluído.'};
      report(copy[result]);noticeUntil=elapsed+3;
    }
    if(current)observations.push({kind:current.kind,target:current.target,result});
    observations=observations.slice(-5);lastResult=result;current=null;control={};nextIdle=elapsed+3+Math.random()*5;
  }
  function begin(action,source){
    const hand=action.hand==='left'?'left':'right';
    current={kind:action.kind,target:action.target,hand,duration:Math.max(1.5,Math.min(8,Number(action.duration)||4)),at:elapsed,source,serial:++serial};
    const words={look:'observando',point:'apontando para',reach:'tentando alcançar',hold:'tentando pegar',release:'soltando',inspect_hand:'examinando',wave:'acenando para',rest:'descansando perto de'};
    report((source==='idle'?'Por conta própria: ':'Na conversa: ')+words[current.kind]+' '+name(current.target)+'.');
  }
  function request(payload={}){
    queue=[];if(current)finish('interrupted');
    for(const action of Array.isArray(payload.actions)?payload.actions.slice(0,4):[]){
      if(action&&KINDS.has(action.kind)&&TARGETS.has(action.target)&&['left','right'].includes(action.hand))queue.push({...action});
    }
    nextIdle=elapsed+Math.max(6,Math.min(22,(payload.text?.length||0)*.07));
  }
  function heldControl(){
    const result={arms:{},hands:{}};
    for(const item of objects.values())if(item.heldBy){
      result.arms[item.heldBy]=item.heldAt.clone();
      result.hands[item.heldBy]={pose:'free',thumb:.65,index:.75,middle:.8,ring:.8};
    }
    return result;
  }
  function spontaneous(){
    const choices=[{kind:'inspect_hand',target:'left_hand',hand:'left'},
      {kind:'inspect_hand',target:'right_hand',hand:'right'},
      {kind:'look',target:'orb',hand:'right'}, {kind:'look',target:'crystal',hand:'left'},
      {kind:'reach',target:'orb',hand:'right'}, {kind:'point',target:'crystal',hand:'left'}].filter(a=>a.target!==lastTarget);
    const action=choices[Math.floor(Math.random()*choices.length)];lastTarget=action.target;
    begin({...action,duration:3+Math.random()*2},'idle');
  }
  function update(dt){
    elapsed+=dt;
    for(const item of objects.values())if(!item.heldBy){
      // Returning props are a simple local simulation, not a physics engine.
      const floating=item.home.clone();floating.y+=Math.sin(elapsed*1.2+(item.home.x>0?2:0))*.025;
      item.mesh.position.lerp(floating,1-Math.exp(-dt*3));item.mesh.rotation.y+=dt*.35;
    }
    if(busy){control=heldControl();return control}
    if(!current&&queue.length)begin(queue.shift(),'conversation');
    if(!current&&enabled&&!speaking&&elapsed>=nextIdle)spontaneous();
    if(!current){control=heldControl();if(elapsed>=noticeUntil)report(holdingSide?'Segurando um objeto e acompanhando a conversa.':enabled?'Observando o ambiente virtual.':'Aguardando seu próximo pedido.');return control}
    const action=current,age=elapsed-action.at,point=target(action.target);
    control={...heldControl(),look:point.clone(),source:action.source};
    if(action.kind==='release'){
      for(const item of objects.values())if(item.heldBy===action.hand){item.heldBy=null;holdingSide=null}
      finish('released');return control;
    }
    if(action.kind==='inspect_hand'){
      const side=action.target==='left_hand'?'left':action.target==='right_hand'?'right':action.hand;
      const head=position(find('Head')),sign=side==='left'?1:-1;
      control.arms[side]=head.add(new THREE.Vector3(sign*.26,-.30,.42));
      control.hands[side]={pose:'free',thumb:.08,index:.10+.22*(.5+.5*Math.sin(age*1.7)),middle:.18,ring:.20};
      control.look=position(hands[side]);
    }else if(['point','reach','hold'].includes(action.kind)&&(action.kind!=='hold'||objects.has(action.target))){
      control.arms[action.hand]=point;
      control.hands[action.hand]={pose:'free',thumb:.25,index:action.kind==='point'?0:.18,middle:action.kind==='point'?.8:.2,ring:action.kind==='point'?.8:.2};
    }else if(action.kind==='wave'){
      const sign=action.hand==='left'?1:-1,shoulder=position(find(action.hand==='left'?'LeftArm':'RightArm'));
      control.arms[action.hand]=shoulder.add(new THREE.Vector3(sign*(.30+.07*Math.sin(age*6)),.35,.28));
      control.hands[action.hand]={pose:'free',thumb:0,index:0,middle:0,ring:0};
    }
    if(age>=action.duration){
      finish(['hold','reach'].includes(action.kind)?'not_reached':'completed');
      return {};
    }
    return control;
  }
  function afterPose(){
    model.updateWorldMatrix(true,true);
    if(current&&['hold','reach'].includes(current.kind)&&objects.has(current.target)){
      const object=objects.get(current.target),p=position(hands[current.hand]);
      const distance=p.distanceTo(object.mesh.position);
      if(distance<.15){
        if(current.kind==='hold'){
          for(const previous of objects.values())if(previous.heldBy===current.hand)previous.heldBy=null;
          object.heldBy=current.hand;object.heldAt=p.clone();holdingSide=current.hand;
        }
        finish(current.kind==='hold'?'held':'reached');
      }
    }
    for(const item of objects.values())if(item.heldBy){
      item.mesh.position.copy(position(hands[item.heldBy])).add(new THREE.Vector3(0,0,.07));
    }
  }
  function perceive(){
    return {schema:1,kind:'virtual_scene',state:lastResult,
      body:{head:copyPoint(position(find('Head'))),left_hand:copyPoint(position(hands.left)),right_hand:copyPoint(position(hands.right))},
      objects:[...objects].map(([id,item])=>({id,position:copyPoint(item.mesh.position),heldBy:item.heldBy||'none'})),
      recent:observations.map(item=>({...item}))};
  }
  report('Observando o ambiente virtual.');
  return {update,afterPose,request,perceive,
    setBusy(value){busy=!!value;if(busy){queue=[];if(current)finish('interrupted')}nextIdle=Math.max(nextIdle,elapsed+5)},
    setSpeaking(value){speaking=!!value;nextIdle=Math.max(nextIdle,elapsed+4)},
    setEnabled(value){enabled=!!value;if(!enabled&&current?.source==='idle')finish('paused');nextIdle=elapsed+3},
    reset(){queue=[];current=null;control={};busy=speaking=false;holdingSide=null;lastResult='ready';observations=[];noticeUntil=0;for(const item of objects.values()){item.heldBy=null;item.mesh.position.copy(item.home)}nextIdle=elapsed+5},
    dispose(){root.removeFromParent();for(const item of objects.values()){item.mesh.geometry.dispose();item.mesh.material.dispose()}}
  };
}
