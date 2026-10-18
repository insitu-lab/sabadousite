/* Gestos autorais criados em código sobre o esqueleto do personagem. */
import * as THREE from '../vendor/three/build/three.module.js';

const catalog=window.SabadouPoses;
if(!catalog?.idle)throw new Error('O catálogo de expressões não foi carregado.');
export const GESTURES=Object.fromEntries(Object.entries(catalog).filter(([id])=>id!=='idle')
  .map(([id,pose])=>[id,{...pose,once:!pose.loop,returnToIdle:!pose.loop}]));

export function createGestureFactory(model,idleClip){
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

  function applyPose(config,phase){
    const kind=config.kind,s=Math.sin(phase),s2=Math.sin(phase*2),s3=Math.sin(phase*3);
    const r=config.r?.slice(),l=config.l?.slice(),h=config.head||[0,0,0],b=config.chest||[0,0,0];
    rotate(chest,b[0]+.012*s,b[1],b[2]);rotate(head,...h);
    switch(kind){
      case 'talk':r[1]+=.08*s2;r[2]+=.08*s;l[1]-=.08*s2;l[2]-=.08*s;rotate(head,.055*s2,.04*s,0);break;
      case 'explain':r[1]+=.1*s;r[2]+=.08*s2;l[2]-=.04*s;rotate(head,.045*s,0,0);break;
      case 'steps':r[1]+=.14*s2;l[1]-=.12*s2;rotate(head,.05*s2,.035*s,0);break;
      case 'slow':r[1]+=.035*s;l[1]-=.035*s;rotate(head,.025*s,0,0);break;
      case 'open':r[0]+=.07*s;l[0]+=.07*s;break;
      case 'present':if(r)r[1]+=.035*s;if(l)l[1]+=.035*s;rotate(head,.02*s,0,0);break;
      case 'point':if(r)r[2]+=.025*s;if(l)l[2]+=.025*s;break;
      case 'wave':r[0]+=.08*s3;rotate(head,0,.05*s,0);break;
      case 'wave_both':r[0]+=.07*s3;l[0]-=.07*s3;rotate(head,0,.025*s,0);break;
      case 'welcome':r[0]+=.08*s;l[0]+=.08*s;rotate(chest,.025*s,0,0);break;
      case 'goodbye':l[0]+=.07*s2;rotate(head,.03*s,0,0);break;
      case 'nod':rotate(head,.20*s2,0,0);break;
      case 'nod_small':rotate(head,.09*s,0,0);break;
      case 'shake':rotate(head,0,.22*s2,0);break;
      case 'shrug':r[1]+=.09*s;l[1]+=.09*s;rotate(head,0,.04*s,.03*s);break;
      case 'curious':rotate(head,.025*s,.06*s,0);r[2]+=.04*s;break;
      case 'idea':r[1]+=.06*s;rotate(head,-.045*s,0,0);break;
      case 'surprise':r[2]+=.09*s;l[2]+=.09*s;rotate(chest,-.025*s,0,0);break;
      case 'amazed':r[0]+=.04*s;l[0]-=.04*s;rotate(head,0,.09*s,0);break;
      case 'sway':rotate(chest,0,0,.045*s);rotate(head,0,0,-.03*s);break;
      case 'laugh':rotate(chest,.06*s3,0,0);rotate(head,.08*s3,0,0);break;
      case 'celebrate':r[1]+=.07*s2;l[1]-=.07*s2;rotate(head,0,.035*s2,0);break;
      case 'cheer':r[1]+=.08*s3;l[2]+=.08*s3;rotate(chest,0,-.035*s,0);break;
      case 'victory':rotate(chest,0,.025*s,0);break;
      case 'hips':rotate(head,0,.04*s,0);break;
      case 'thanks':rotate(head,.045*s,0,0);break;
      case 'bow':rotate(chest,.035*s,0,0);break;
      case 'encourage':r[2]+=.08*s2;rotate(head,.065*s2,0,0);break;
      case 'reassure':r[1]+=.035*s;l[1]+=.035*s;rotate(head,.025*s,0,0);break;
      case 'empathy':l[2]+=.035*s;rotate(head,.02*s,0,0);break;
      case 'sorry':rotate(head,.035*s,0,0);break;
      case 'disappointed':rotate(head,0,.035*s,0);break;
      case 'confused':rotate(head,0,.12*s,0);r[0]+=.05*s;break;
      case 'shy':rotate(head,0,.045*s,0);break;
      case 'patient':rotate(chest,.008*s,0,0);break;
      case 'listen':rotate(head,.035*s,0,0);break;
      case 'attentive':rotate(head,0,.04*s,0);break;
      case 'respect':rotate(head,.03*s,0,0);break;
      case 'careful':r[2]+=.035*s;rotate(head,0,.045*s,0);break;
      case 'playful':rotate(chest,0,.045*s,.055*s);r[1]+=.10*s2;l[1]-=.08*s2;break;
      case 'confident':rotate(head,0,.025*s,0);break;
    }
    if(r)armPose(right,target(right,...r));if(l)armPose(left,target(left,...l));
    if(kind==='chin_right')armPose(right,restHead.clone().add(new THREE.Vector3(-height*.035,-height*.045,height*.12)));
    if(kind==='chin_left')armPose(left,restHead.clone().add(new THREE.Vector3(height*.035,-height*.04,height*.12)));
    if(kind==='head_touch')armPose(right,restHead.clone().add(new THREE.Vector3(-height*.08,height*.025,height*.06)));
    if(kind==='clap'){
      const gap=height*(.025+.055*(1+Math.cos(phase*3))/2),center=shoulderCenter.clone().add(new THREE.Vector3(0,-height*.08,height*.24));
      armPose(right,center.clone().add(new THREE.Vector3(-gap,0,0)));
      armPose(left,center.clone().add(new THREE.Vector3(gap,0,0)));
      rotate(right.hand,0,.45,0);rotate(left.hand,0,-.45,0);
    }
    if(kind==='wave'||kind==='wave_both')rotate(right.hand,0,0,.30*s3);
    if(kind==='goodbye'||kind==='wave_both')rotate(left.hand,0,0,-.24*s3);
  }

  // Cria apenas a expressão pedida, preservando a pose em reprodução.
  return id=>{
    const config=GESTURES[id];if(!config)throw new Error('Expressão desconhecida.');
    const live=bones.map(bone=>[bone,bone.quaternion.clone()]);
    const frames=36,times=Float32Array.from({length:frames+1},(_,i)=>i/frames*config.duration);
    const values=new Map(bones.map(bone=>[bone,[]]));
    try{
    for(let i=0;i<=frames;i++){
      const p=i/frames,phase=p*Math.PI*2;
      const envelope=THREE.MathUtils.smoothstep(p,0,.18)*(1-THREE.MathUtils.smoothstep(p,.8,1));
      restore();applyPose(config,phase);
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
    return new THREE.AnimationClip(id,config.duration,tracks);
    }finally{for(const [bone,quaternion] of live)bone.quaternion.copy(quaternion);model.updateWorldMatrix(true,true)}
  };
}
