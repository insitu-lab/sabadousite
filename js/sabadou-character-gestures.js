/* Gestos autorais criados em código sobre o esqueleto do personagem. */
import * as THREE from '../vendor/three/build/three.module.js';

export const GESTURES={
  talk:{label:'explicando',duration:4.2},
  point:{label:'apontando',duration:2.8,once:true,returnToIdle:true},
  wave:{label:'acenando',duration:3,once:true,returnToIdle:true},
  think:{label:'pensando',duration:3.8,once:true,returnToIdle:true},
  yes:{label:'confirmando',duration:2.2,once:true,returnToIdle:true},
  celebrate:{label:'comemorando',duration:3.4,once:true,returnToIdle:true}
};

export function createGestures(model,idleClip){
  const bones=[];model.traverse(node=>{if(node.isBone)bones.push(node)});
  const base=new Map(bones.map(bone=>[bone,bone.quaternion.clone()]));
  // Preserve os números: Spine, Spine1 e Spine2 são ossos diferentes.
  const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
  const find=suffix=>bones.find(bone=>normalize(bone.name).endsWith(normalize(suffix)));
  const head=find('Head'),chest=find('Spine2');
  const right={upper:find('RightArm'),lower:find('RightForeArm'),hand:find('RightHand')};
  const left={upper:find('LeftArm'),lower:find('LeftForeArm'),hand:find('LeftHand')};
  if(!head||!chest||![right,left].every(arm=>arm.upper&&arm.lower&&arm.hand))throw new Error('O modelo precisa de cabeça, coluna e braços articulados para criar os gestos.');
  const position=bone=>bone.getWorldPosition(new THREE.Vector3());
  const restore=()=>{for(const bone of bones)bone.quaternion.copy(base.get(bone));model.updateWorldMatrix(true,true)};
  const rotate=(bone,x,y,z)=>{if(bone)bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)))};
  const restHead=position(head);
  const height=new THREE.Box3().setFromObject(model,true).getSize(new THREE.Vector3()).y;
  const shoulderCenter=position(right.upper).add(position(left.upper)).multiplyScalar(.5);

  function setWorldQuaternion(bone,world){
    const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(parent.multiply(world));model.updateWorldMatrix(true,true);
  }
  function aim(bone,child,target){
    const origin=position(bone),from=position(child).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
    const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
    setWorldQuaternion(bone,delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
  }
  function armPose(arm,target){
    model.updateWorldMatrix(true,true);
    const start=position(arm.upper),middle=position(arm.lower),end=position(arm.hand);
    const a=start.distanceTo(middle),b=middle.distanceTo(end),towards=target.clone().sub(start);
    const distance=THREE.MathUtils.clamp(towards.length(),Math.abs(a-b)+.001,(a+b)*.97),direction=towards.normalize();
    const bend=new THREE.Vector3(0,-1,.55).addScaledVector(direction,-new THREE.Vector3(0,-1,.55).dot(direction));
    if(bend.lengthSq()<.001)bend.set(0,0,1);bend.normalize();
    const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
    const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,rise);
    const destination=start.clone().addScaledVector(direction,distance);
    aim(arm.upper,arm.lower,elbow);aim(arm.lower,arm.hand,destination);
  }
  function target(arm,x,y,z){
    const start=position(arm.upper),reach=start.distanceTo(position(arm.lower))+position(arm.lower).distanceTo(position(arm.hand));
    const side=Math.sign(start.x-shoulderCenter.x)||1;
    return start.add(new THREE.Vector3(side*x*reach,y*reach,z*reach));
  }

  const clips=new Map();
  try{
  for(const [id,config] of Object.entries(GESTURES)){
    const frames=48,times=Float32Array.from({length:frames+1},(_,i)=>i/frames*config.duration);
    const values=new Map(bones.map(bone=>[bone,[]]));
    for(let i=0;i<=frames;i++){
      const p=i/frames,phase=p*Math.PI*2;
      const envelope=THREE.MathUtils.smoothstep(p,0,.18)*(1-THREE.MathUtils.smoothstep(p,.8,1));
      restore();rotate(chest,.018*Math.sin(phase),.018*Math.sin(phase),0);
      if(id==='talk'){
        rotate(head,.055*Math.sin(phase*2),.045*Math.sin(phase),0);
        armPose(right,target(right,.48,-.25+.08*Math.sin(phase*2),.55+.08*Math.sin(phase)));
        armPose(left,target(left,.48,-.3-.08*Math.sin(phase*2),.48-.08*Math.sin(phase)));
      }else if(id==='point'){
        rotate(head,0,-.16,0);armPose(right,target(right,.92,.12,.25));
        rotate(find('RightHandMiddle1'),.7,0,0);rotate(find('RightHandMiddle2'),.6,0,0);rotate(find('RightHandMiddle3'),.4,0,0);
      }else if(id==='wave'){
        rotate(head,0,.06*Math.sin(phase),-.06);
        armPose(right,target(right,.36+.08*Math.sin(phase*3),.77,.25));
        rotate(right.hand,0,0,.3*Math.sin(phase*3));
      }else if(id==='think'){
        rotate(head,.08,.08,.12);
        const chin=restHead.clone().add(new THREE.Vector3(-height*.035,-height*.045,height*.12));
        armPose(right,chin);
      }else if(id==='yes'){
        rotate(head,.2*Math.sin(phase*2),0,0);
      }else if(id==='celebrate'){
        rotate(head,-.08,.04*Math.sin(phase*2),0);
        armPose(right,target(right,.4,.77+.04*Math.sin(phase*2),.18));
        armPose(left,target(left,.4,.77-.04*Math.sin(phase*2),.18));
      }
      for(const bone of bones){
        const quaternion=base.get(bone).clone().slerp(bone.quaternion,envelope).normalize();
        quaternion.toArray(values.get(bone),values.get(bone).length);
      }
    }
    const animatedNames=new Set(bones.map(bone=>bone.name+'.quaternion'));
    const tracks=idleClip.tracks.filter(track=>!animatedNames.has(track.name)).map(track=>{
      const copy=track.clone(),size=track.getValueSize(),first=Array.from(track.values.slice(0,size));
      copy.times=new Float32Array([0,config.duration]);copy.values=new Float32Array([...first,...first]);return copy;
    });
    for(const bone of bones)tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,values.get(bone)));
    clips.set(id,new THREE.AnimationClip(id,config.duration,tracks));
  }
  return clips;
  }finally{restore()}
}
