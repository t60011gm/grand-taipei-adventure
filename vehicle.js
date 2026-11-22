import {assetURL} from './asset-location.js'
import * as T from './vendor/three.js'
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js'
import { DRACOLoader } from './vendor/loaders/DRACOLoader.js'

// The supplied 458 points toward -Z. Keep wheel pivots in that frame and put
// the exterior inside the game's existing +X vehicle footprint.
export async function loadVehicle(){
 const decoder=new DRACOLoader().setDecoderPath('./vendor/libs/draco/gltf/')
 let asset
 try{asset=await new GLTFLoader().setDRACOLoader(decoder).loadAsync(assetURL('berlinetta.glb'))}
 finally{decoder.dispose()}
 const model=asset.scene,root=new T.Group()
 model.rotation.y=-Math.PI/2
 const bounds=new T.Box3().setFromObject(model)
 const scale=4.38/(bounds.max.x-bounds.min.x)
 model.scale.setScalar(scale)
 model.position.set(-(bounds.max.x+bounds.min.x)*scale/2,-bounds.min.y*scale,-(bounds.max.z+bounds.min.z)*scale/2)
 root.add(model)
 const wheelCenter=model.getObjectByName('steering_wheel').getWorldPosition(new T.Vector3())
 const driverSeat=wheelCenter.clone().add(new T.Vector3(-.55,-.47,0))
 const surface=(color,metalness,roughness)=>new T.MeshStandardMaterial({color,metalness,roughness})
 const paint=new T.MeshPhysicalMaterial({color:0xc52619,metalness:.70,roughness:.23,clearcoat:1,clearcoatRoughness:.085})
 const alloy=surface(0xbfc4c7,.91,.23), chrome=surface(0xdfe1db,.94,.12)
 const carbon=surface(0x272a2b,.31,.35),rubber=surface(0x242526,.01,.84)
 const glazing=new T.MeshPhysicalMaterial({color:0x93b1bb,metalness:.15,roughness:.065,transparent:true,opacity:.35,depthWrite:false,clearcoat:1})
 const lamp=surface(0x8c1014,.30,.19);lamp.emissive.setHex(0xff1913)
 const leather=surface(0x302929,.01,.71)
 model.traverse(node=>{
  if(!node.isMesh)return
  const n=node.name
  if(n==='body')node.material=paint
  else if(n==='glass')node.material=glazing
  else if(n.startsWith('rim_')||n==='trim')node.material=alloy
  else if(n==='chrome'||n.startsWith('nuts'))node.material=chrome
  else if(n.startsWith('tire'))node.material=rubber
  else if(n.includes('carbon')||n==='grills')node.material=carbon
  else if(n==='lights_red')node.material=lamp
  else if(n==='leather'||n==='carpet')node.material=leather
 })
 const wheels=['fl','fr','rl','rr'].map(key=>{
  const hub=model.getObjectByName('wheel_'+key),pivot=new T.Group()
  pivot.position.copy(hub.position);hub.parent.add(pivot);pivot.add(hub);hub.position.set(0,0,0)
  return {hub,pivot,front:key[0]==='f'}
 })
 let steer=0
 function update(dt,speed,turn,braking){
  steer=T.MathUtils.damp(steer,-turn*.42,12,dt)
  for(const {hub,pivot,front} of wheels){
   hub.rotateX(-dt*speed/(.35*scale))
   if(front)pivot.rotation.y=steer
  }
  lamp.emissiveIntensity=braking?1.45:.18
 }
 function reflect(renderer,scene,position){
  const cube=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType})
  const probe=new T.CubeCamera(.15,180,cube);probe.position.copy(position);probe.position.y+=1.3
  root.visible=false;probe.update(renderer,scene);root.visible=true
  const filter=new T.PMREMGenerator(renderer),light=filter.fromCubemap(cube.texture)
  model.traverse(o=>{if(o.isMesh){o.material.envMap=light.texture;o.material.envMapIntensity=1.15;o.material.needsUpdate=true}})
  cube.dispose();filter.dispose();return light
 }
 return {root,update,reflect,driverSeat,paint}
}
