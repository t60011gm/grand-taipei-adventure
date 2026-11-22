import {assetURL} from './asset-location.js'
import * as T from './vendor/three.js'
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js'

// Pose limbs by their anatomical directions; the Rocketbox rig has different
// local axes on the left and right even though its rest pose is symmetrical.
export async function loadCitizen(gender){
 const [{scene:rig},walk]=await Promise.all([new GLTFLoader().loadAsync(assetURL(gender==='male'?'citizen-male.glb':'citizen.glb?v=rocketbox')),fetch(assetURL('citizen-walk.json')).then(r=>r.json())])
 function spawn(){
  const copy=rig.clone(true),sources=[],clones=[]
  rig.traverse(o=>sources.push(o));copy.traverse(o=>clones.push(o))
  const map=new Map(sources.map((o,i)=>[o,clones[i]]))
  for(const o of sources)if(o.isSkinnedMesh){
   const mesh=map.get(o),skeleton=o.skeleton.clone()
   skeleton.bones=o.skeleton.bones.map(b=>map.get(b));mesh.bind(skeleton,o.bindMatrix)
  }
  return animate(copy,walk)
 }
 return {...spawn(),spawn}
}
function animate(rig,walk){
 const root=new T.Group(),pivot=new T.Group()
 pivot.add(rig);root.add(pivot)
 const bones={}
 rig.traverse(o=>{if(o.isBone)bones[o.name.replace(/^Bip01[_ ]?/,'').replace(/[_ ]/g,'')]=o
  if(o.isSkinnedMesh)o.frustumCulled=false
 })
 rig.updateMatrixWorld(true)
 const hip=bones.Pelvis.getWorldPosition(new T.Vector3())
 const meshes=[]
 rig.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;meshes.push(o)}})
 function setView(eye,seated){
  for(const mesh of meshes){
   const hide=eye&&(!seated||/head|opacity/i.test(mesh.material.name))
   mesh.layers.set(hide?1:0)
  }
 }
 const bind=new Map(),axis=new Map()
 const sides=['L','R']
 for(const side of sides)for(const [a,b] of [['UpperArm','Forearm'],['Forearm','Hand'],['Thigh','Calf'],['Calf','Foot'],['Foot','Toe0']]){
  const bone=bones[side+a],end=bones[side+b]
  bind.set(bone,bone.quaternion.clone())
  axis.set(bone,end.position.clone().normalize())
 }
 // Blender exports this adult at native metre scale, facing +Z.
 pivot.rotation.y=Math.PI/2
 const desired=new T.Vector3(),parentQ=new T.Quaternion(),alignment=new T.Quaternion(),restAxis=new T.Vector3()
 const rootQ=new T.Quaternion()
 function aim(bone,x,y,z){
  bone.quaternion.copy(bind.get(bone))
  bone.parent.getWorldQuaternion(parentQ)
  desired.set(x,y,z).normalize().applyQuaternion(rootQ).applyQuaternion(parentQ.invert())
  restAxis.copy(axis.get(bone)).applyQuaternion(bone.quaternion)
  alignment.setFromUnitVectors(restAxis,desired)
  bone.quaternion.premultiply(alignment)
 }
 // Solve once in the seated rider's local frame so both adult rigs meet the grips and footboard.
 function reach(side,upper,lower,end,target,bend){
  const point=name=>root.worldToLocal(bones[side+name].getWorldPosition(new T.Vector3()))
  const a=point(upper),b=point(lower),c=point(end)
  const l=a.distanceTo(b),m=b.distanceTo(c),direction=target.clone().sub(a).normalize()
  const d=T.MathUtils.clamp(a.distanceTo(target),Math.abs(l-m)+.0001,l+m-.0001)
  const along=(l*l-m*m+d*d)/(2*d)
  bend.addScaledVector(direction,-bend.dot(direction)).normalize()
  const joint=direction.clone().multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,l*l-along*along)))
  aim(bones[side+upper],joint.x,joint.y,joint.z)
  const fore=target.clone().sub(point(lower))
  aim(bones[side+lower],fore.x,fore.y,fore.z)
 }
 let phase=0,walkWeight=0,breath=0
 const idleDirections=[[.02,-.96,-.15],[.20,-.94,.09],[0,-1,-.045],[-.035,-1,0],[1,-.18,0]]
 function update(dt,speed,seated,steer){
  root.getWorldQuaternion(rootQ)
  walkWeight=T.MathUtils.damp(walkWeight,Math.abs(speed)>.07?1:0,13,dt)
  phase=(phase+dt*speed/1.55+1)%1;breath+=dt
  const progress=phase*walk.length,frame=Math.floor(progress),next=(frame+1)%walk.length,f=progress-frame
  for(let i=0;i<2;i++){
   const side=sides[i],lateral=i===0?-1:1
   if(seated){
    aim(bones[side+'Thigh'],.97,-.16,lateral*.15);aim(bones[side+'Calf'],.51,-.86,lateral*.025)
    aim(bones[side+'Foot'],.96,-.14,0)
    if(seated==='scooter'){
     aim(bones[side+'Thigh'],.88,-.42,lateral*.15);aim(bones[side+'Calf'],-.15,-.98,0)
     aim(bones[side+'UpperArm'],.48,-.83,lateral*.21);aim(bones[side+'Forearm'],.97,-.20,lateral*.12)
    }else if(seated==='passenger'){
     aim(bones[side+'UpperArm'],.22,-.95,lateral*.13);aim(bones[side+'Forearm'],.79,-.36,-lateral*.31)
    }else{
     aim(bones[side+'UpperArm'],.54,-.77,lateral*.25);aim(bones[side+'Forearm'],.93,.32+steer*lateral*.14,-lateral*.16)
    }
   }else{
    for(const [j,name] of ['UpperArm','Forearm','Thigh','Calf','Foot'].entries()){
     const a=walk[frame][i*5+j],b=walk[next][i*5+j]
     const v=idleDirections[j].map((idle,k)=>T.MathUtils.lerp(k===2&&i===1?-idle:idle,T.MathUtils.lerp(a[k],b[k],f),walkWeight))
     aim(bones[side+name],...v)
    }
   }
  }
  const bounce=T.MathUtils.lerp(walk[frame][10],walk[next][10],f)-.918
  pivot.position.y=seated?-hip.y:bounce*walkWeight+.004*Math.sin(breath*2)*(1-walkWeight)
  if(seated==='scooter')for(const [i,side] of sides.entries()){
   const sign=i===0?-1:1
   reach(side,'Thigh','Calf','Foot',new T.Vector3(.39,-.43,sign*.156),new T.Vector3(1,0,0))
   aim(bones[side+'Foot'],1,-.08,0)
   reach(side,'UpperArm','Forearm','Hand',new T.Vector3(.605,.181,sign*.288),new T.Vector3(0,-1,sign*.2))
  }
 }
 return {root,update,setView,head:bones.Head}
}
