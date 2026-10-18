/* Procedural body, independent fingers and bounded AI targets. No executable AI code. */
import * as THREE from '../vendor/three/build/three.module.js';

const DIGITS=['thumb','index','middle','ring'];
const clamp=(value,min,max,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?THREE.MathUtils.clamp(value,min,max):fallback;
export function createBodyController(model){
  const limits=window.SabadouRig||{},bones=[];
  model.traverse(node=>{if(node.isBone)bones.push(node)});
  const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
  const find=name=>bones.find(bone=>normalize(bone.name).endsWith(normalize(name)));
  const joints=new Map(Object.keys(limits).map(name=>[name,find(name)]));
  const offsets=new Map([...joints.keys()].map(name=>[name,new THREE.Quaternion()]));
  const applied=new Map(bones.map(bone=>[bone,new THREE.Quaternion()]));
  const starting=new Map(bones.map(bone=>[bone,new THREE.Quaternion()]));
  const sides=['Left','Right'].map((side,index)=>({
    side,key:side.toLowerCase(),sign:index===0?1:-1,
    upper:find(side+'Arm'),lower:find(side+'ForeArm'),hand:find(side+'Hand'),
    target:new THREE.Vector3(.22,-.84,.22),roll:0,externalWeight:0,externalTarget:new THREE.Vector3(),hasExternal:false,
    fingers:DIGITS.map(digit=>{
      const name=side+'Hand'+digit[0].toUpperCase()+digit.slice(1);
      return {digit,parts:[1,2].map(segment=>{
        const bone=find(name+segment),child=find(name+(segment+1));
        const axis=child?.position.clone().normalize().cross(new THREE.Vector3(0,0,1)).normalize();
        return {name:name+segment,bone,axis,q:new THREE.Quaternion()};
      })};
    })
  }));
  let tracks=new Map(),profile={},until=0,profileAt=0,active=false,thinking=false;
  let custom=false,weight=0,armWeight=0,elapsed=0,nextLook=0,lookX=0,lookY=0,aimX=0,aimY=0;
  let pointerAt=-Infinity,pointerX=0,pointerY=0,energy=.5,tempo=1;
  let environment={};
  const worldLook=new THREE.Vector3();let worldLookWeight=0,hasWorldLook=false;
  const temp=new THREE.Quaternion(),goal=new THREE.Quaternion(),euler=new THREE.Euler();
  const position=bone=>bone?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();
  const rotate=(bone,x,y,z)=>{if(bone)bone.quaternion.multiply(temp.setFromEuler(euler.set(x,y,z)))};
  function beforeUpdate(){
    // AnimationMixer can skip writing constant tracks. Remove our previous
    // contribution first, otherwise rotations on those bones accumulate.
    for(const [bone,q] of applied){bone.quaternion.multiply(temp.copy(q).invert());q.identity()}
  }
  function setProfile(payload={}){
    profile=payload;profileAt=performance.now();until=profileAt+Math.min(20000,Math.max(3500,(payload.text?.length||0)*70));
    energy=clamp(payload.body?.energy,.15,1,.5);tempo=clamp(payload.body?.tempo,.6,1.6,1);
    custom=['left','right'].every(side=>{
      const arm=payload.arms?.[side];return arm&&['x','y','z','roll'].every(key=>Number.isFinite(arm[key]));
    });
    tracks=new Map();
    for(const move of Array.isArray(payload.moves)?payload.moves.slice(0,16):[]){
      if(!move||typeof move.joint!=='string'||!Object.hasOwn(limits,move.joint)||!joints.get(move.joint))continue;
      const bound=limits[move.joint],entry={at:clamp(move.at,0,1),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(
        ...['x','y','z'].map((key,index)=>THREE.MathUtils.degToRad(clamp(move[key],-bound[index],bound[index])))))};
      if(!tracks.has(move.joint))tracks.set(move.joint,[]);
      const list=tracks.get(move.joint),existing=list.findIndex(frame=>Math.abs(frame.at-entry.at)<.001);
      if(existing>=0)list[existing]=entry;else list.push(entry);
    }
    for(const list of tracks.values())list.sort((a,b)=>a.at-b.at);
    return custom;
  }
  function sample(list,phase){
    if(list.length===1)return goal.copy(list[0].q);
    let a=list[list.length-1],b=list[0],start=a.at,end=b.at+1,p=phase;
    for(let i=0;i<list.length-1;i++)if(phase>=list[i].at&&phase<list[i+1].at){a=list[i];b=list[i+1];start=a.at;end=b.at;break}
    if(p<start)p+=1;
    const t=THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((p-start)/Math.max(.001,end-start),0,1),0,1);
    return goal.copy(a.q).slerp(b.q,t);
  }
  function worldRotation(bone,q){
    const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(parent.multiply(q));model.updateWorldMatrix(true,true);
  }
  function aim(bone,child,target){
    const origin=position(bone),from=position(child).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
    const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
    worldRotation(bone,delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
  }
  function solve(arm,coordinates,amount){
    if(!arm.upper||!arm.lower||!arm.hand||amount<.001)return;
    model.updateWorldMatrix(true,true);
    const upperBefore=arm.upper.quaternion.clone(),lowerBefore=arm.lower.quaternion.clone();
    const start=position(arm.upper),middle=position(arm.lower),end=position(arm.hand);
    const a=start.distanceTo(middle),b=middle.distanceTo(end),reach=a+b;
    const target=start.clone().add(new THREE.Vector3(arm.sign*coordinates.x,coordinates.y,coordinates.z).multiplyScalar(reach));
    const direction=target.clone().sub(start).normalize(),distance=THREE.MathUtils.clamp(start.distanceTo(target),Math.abs(a-b)+.001,reach*.96);
    const pole=new THREE.Vector3(arm.sign*.15,-1,.28);
    const bend=pole.addScaledVector(direction,-pole.dot(direction));
    if(bend.lengthSq()<.0001)bend.set(0,0,1).addScaledVector(direction,-direction.z);
    bend.normalize();
    const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
    const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,rise);
    aim(arm.upper,arm.lower,elbow);const upperGoal=arm.upper.quaternion.clone();
    aim(arm.lower,arm.hand,start.clone().addScaledVector(direction,distance));const lowerGoal=arm.lower.quaternion.clone();
    arm.upper.quaternion.copy(upperBefore).slerp(upperGoal,amount);
    arm.lower.quaternion.copy(lowerBefore).slerp(lowerGoal,amount);model.updateWorldMatrix(true,true);
  }
  function orientThumb(arm,amount){
    if(!arm.hand)return;
    const before=arm.hand.quaternion.clone();
    const y=new THREE.Vector3(arm.sign*.051,.064,.025).normalize();
    const z=new THREE.Vector3(0,0,1).addScaledVector(y,-y.z).normalize(),x=new THREE.Vector3().crossVectors(y,z).normalize();
    const frame=new THREE.Matrix4().makeBasis(x,y,z);
    worldRotation(arm.hand,new THREE.Quaternion().setFromRotationMatrix(frame).invert());
    const after=arm.hand.quaternion.clone();arm.hand.quaternion.copy(before).slerp(after,amount);
  }
  function update(now,dt){
    for(const bone of bones)starting.get(bone).copy(bone.quaternion);
    elapsed+=dt;const engaged=active||now<until;
    weight+=(Number(engaged)-weight)*(1-Math.exp(-dt*5));
    armWeight+=(Number(engaged&&custom)-armWeight)*(1-Math.exp(-dt*5));
    const rate=elapsed*(engaged?tempo:1),phase=((now-profileAt)/5600*tempo)%1;
    for(const [name,bone] of joints){
      if(!bone)continue;const list=tracks.get(name);temp.identity();
      if(list&&weight>.001)temp.slerp(sample(list,phase),weight);
      const current=offsets.get(name);current.slerp(temp,1-Math.exp(-dt*9));bone.quaternion.multiply(current);
    }
    // Non-periodic combinations and occasional attention shifts give the
    // character a living rest state, without making requests to the AI.
    if(elapsed>=nextLook){aimX=(Math.random()-.5)*.34;aimY=(Math.random()-.5)*.14;nextLook=elapsed+3.5+Math.random()*4}
    const hover=elapsed-pointerAt<2.5;
    lookX+=((hover?pointerX*.22:aimX)-lookX)*(1-Math.exp(-dt*1.7));
    lookY+=((hover?pointerY*.12:aimY)-lookY)*(1-Math.exp(-dt*1.7));
    const rest=1-weight*.7,breathe=Math.sin(rate*1.6),shift=Math.sin(rate*.39)+.35*Math.sin(rate*.71);
    rotate(find('Hips'),0,.018*shift*rest,.014*shift*rest);
    rotate(find('Spine1'),.018*breathe,.025*Math.sin(rate*.47)*rest,-.018*shift*rest);
    rotate(find('Spine2'),.022*Math.sin(rate*1.6-.4),.035*Math.sin(rate*.31)*rest,.018*Math.sin(rate*.57)*rest);
    rotate(find('Head'),lookY*rest+.02*Math.sin(rate*.83),lookX*rest,.035*Math.sin(rate*.37)*rest+(thinking?.09:0));
    if(environment.look?.isVector3){
      if(!hasWorldLook)worldLook.copy(position(find('Head'))).add(new THREE.Vector3(0,0,1));
      worldLook.lerp(environment.look,1-Math.exp(-dt*4));hasWorldLook=true;
    }
    worldLookWeight+=(Number(!!environment.look?.isVector3)-worldLookWeight)*(1-Math.exp(-dt*5));
    if(hasWorldLook&&worldLookWeight>.001){
      const head=find('Head');
      if(head){
        const delta=worldLook.clone().sub(position(head));
        const pitch=THREE.MathUtils.clamp(-Math.atan2(delta.y,Math.hypot(delta.x,delta.z)),-.55,.7);
        const yaw=THREE.MathUtils.clamp(Math.atan2(delta.x,delta.z),-.8,.8),before=head.quaternion.clone();
        worldRotation(head,new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0)));
        const after=head.quaternion.clone();head.quaternion.copy(before).slerp(after,.85*worldLookWeight);
      }
    }
    for(const arm of sides){
      const override=environment.arms?.[arm.key];
      const external=!!override?.isVector3;
      if(external){
        if(!arm.hasExternal)arm.externalTarget.copy(position(arm.hand));
        arm.externalTarget.lerp(override,1-Math.exp(-dt*5));arm.hasExternal=true;
      }
      arm.externalWeight+=(Number(external)-arm.externalWeight)*(1-Math.exp(-dt*6));
      const hand=environment.hands?.[arm.key]||profile.hands?.[arm.key],handWeight=Math.max(weight,arm.externalWeight);
      const isThumb=handWeight>.001&&hand?.pose==='thumbs_up';
      rotate(find(arm.side+'Shoulder'),.022*breathe,0,-arm.sign*.02*Math.sin(rate*1.6)*rest);
      rotate(arm.upper,.045*Math.sin(rate*.61+arm.sign)*rest,arm.sign*.025*shift*rest,arm.sign*.045*Math.sin(rate*.43)*rest);
      rotate(arm.lower,0,-arm.sign*.055*Math.sin(rate*.67+arm.sign)*rest,0);
      if(custom){
        const target=profile.arms[arm.key],gesture=Math.sin(rate*2.2+arm.sign)*energy*.045;
        const next=new THREE.Vector3(clamp(target.x,-.6,1),clamp(target.y,-.95,1)+gesture,clamp(target.z,-.1,1));
        arm.target.lerp(next,1-Math.exp(-dt*4));arm.roll+=(clamp(target.roll,-100,100)-arm.roll)*(1-Math.exp(-dt*4));
        solve(arm,arm.target,armWeight);rotate(arm.hand,0,0,THREE.MathUtils.degToRad(arm.roll)*armWeight);
      }
      if(arm.hasExternal&&arm.externalWeight>.001&&arm.upper&&arm.lower&&arm.hand){
        model.updateWorldMatrix(true,true);
        const reach=position(arm.upper).distanceTo(position(arm.lower))+position(arm.lower).distanceTo(position(arm.hand));
        const relative=arm.externalTarget.clone().sub(position(arm.upper)).divideScalar(Math.max(.001,reach));relative.x*=arm.sign;
        solve(arm,relative,arm.externalWeight);
      }else if(!external)arm.hasExternal=false;
      if(isThumb)orientThumb(arm,handWeight);
      for(const finger of arm.fingers){
        const resting=.10+.045*Math.sin(rate*.77+arm.sign+DIGITS.indexOf(finger.digit));
        let curl=clamp(hand?.[finger.digit],0,1,.12)*handWeight+resting*(1-handWeight);
        if(isThumb)curl=(finger.digit==='thumb'?0:1)*handWeight+resting*(1-handWeight);
        for(let i=0;i<finger.parts.length;i++){
          const part=finger.parts[i];if(!part.bone||!part.axis||(!environment.hands?.[arm.key]&&!isThumb&&tracks.has(part.name)))continue;
          const angle=curl*(i===0?1.15:1.55)*(finger.digit==='thumb'?.7:1);
          goal.setFromAxisAngle(part.axis,angle);part.q.slerp(goal,1-Math.exp(-dt*7));part.bone.quaternion.copy(part.q);
        }
      }
    }
    for(const bone of bones)applied.get(bone).copy(starting.get(bone)).invert().multiply(bone.quaternion);
  }
  return {
    get custom(){return custom},hasFingers:sides.every(arm=>arm.fingers.every(finger=>finger.parts.every(part=>part.bone))),
    setProfile,update,beforeUpdate,worldControl(value){environment=value||{}},
    speak(value){active=!!value;if(!active)until=0},
    think(value){thinking=!!value},
    gaze(x,y){pointerX=clamp(x,-1,1);pointerY=clamp(y,-1,1);pointerAt=elapsed},
    reset(){beforeUpdate();tracks=new Map();profile={};environment={};hasWorldLook=false;worldLookWeight=0;custom=false;active=thinking=false;until=0;weight=armWeight=0;for(const arm of sides){arm.externalWeight=0;arm.hasExternal=false}for(const q of offsets.values())q.identity()}
  };
}
