import * as T from './vendor/three.js'
import {trafficModel} from './traffic-models.js'
import {types,scooterPaints} from './fleet.js'

// Bake paint, window pillars, lamps, wheel hubs and bus doors into vertex colours.
// All visible vehicles of one variant share a single instanced draw call.
function body(type,paint){
 const {name,length:L,width:W,height:H}=type,bus=name==='bus',van=name==='van',suv=name==='suv'
 const pos=[],colors=[],color=new T.Color()
 function tri(a,b,c,tint){pos.push(...a,...b,...c);color.set(tint);for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b)}
 function quad(a,b,c,d,tint){tri(a,b,c,tint);tri(a,c,d,tint)}
 const belt=H*(bus?.43:.57),glass=0x364c55
 // Cross-sections from tail to nose: fraction of length, roof height, roof half-width.
 const roof=bus||van?[[0,.87,.45],[.035,1,.48],[.91,1,.48],[1,.74,.46]]:
 [[0,.56,.44],[.12,suv||name==='hatch'?.93:.63,.45],[.31,1,.43],[.56,1,.43],[.76,.65,.46],[.95,.58,.47],[1,.51,.44]]
 const sections=roof.map(([f,h,w])=>{
  const x=(f-.5)*L,y=H*h
  return [[x,.28,-W*.45],[x,Math.min(belt,y-.08),-W*.5],[x,y,-W*w],[x,y,W*w],[x,Math.min(belt,y-.08),W*.5],[x,.28,W*.45]]
 })
 for(let i=1;i<sections.length;i++){
  const a=sections[i-1],b=sections[i]
  for(let j=0;j<6;j++){
   const k=(j+1)%6,window=(j===1||j===3)&&Math.min(a[2][1],b[2][1])>belt+.1
   const windshield=j===2&&!bus&&!van&&(i===4||i===2&&name==='sedan')
   quad(a[j],b[j],b[k],a[k],window||windshield?glass:paint)
  }
 }
 for(const end of [sections[0],sections.at(-1)])for(let k=1;k<5;k++)tri(end[0],end[k],end[k+1],paint)
 function panel(x,y,z,w,h,tint,side){
  const dx=side?w/2:0,dz=side?0:w/2
  quad([x-dx,y,z-dz],[x+dx,y,z+dz],[x+dx,y+h,z+dz],[x-dx,y+h,z-dz],tint)
 }
 for(const sign of [-1,1]){
  const z=sign*W*.502
  if(bus||van){
   const count=bus?8:3
   for(let i=0;i<count;i++)panel((-.44+(i+.5)*.87/count)*L,H*.48,z,L*.87/count-.06,H*.37,glass,true)
   if(bus){
    panel(0,.54,z,L*.95,.22,0x2e9388,true)
    if(sign>0)for(const f of [-.06,.35])panel(f*L,.31,z+.007,1.14,H*.72,0x273a41,true)
   }
  }else panel(-.07*L,belt,z,.11,H*.30,paint,true)
  const radius=bus?.48:.32
  for(const fx of [-.29,.30]){
   const x=fx*L
   for(let k=0;k<12;k++){
    const pt=(n,r,offset)=>[x+r*Math.cos(n*Math.PI/6),radius+r*Math.sin(n*Math.PI/6),z+sign*offset]
    quad(pt(k,radius,0),pt(k+1,radius,0),pt(k+1,radius,.035),pt(k,radius,.035),0x212329)
    tri([x,radius,z+sign*.036],pt(k,radius,.036),pt(k+1,radius,.036),0x23262a)
    tri([x,radius,z+sign*.039],pt(k,radius*.57,.039),pt(k+1,radius*.57,.039),0x9ba5a7)
   }
  }
  panel(L*.501,H*.37,sign*W*.33,W*.23,.12,0xfff1c6,false)
  panel(-L*.501,H*.38,sign*W*.33,W*.20,.12,0xcd382b,false)
 }
 if(bus||van)panel(L*.501,H*.49,0,W*.85,H*.24,glass,false)
 if(bus)panel(L*.502,H*.77,0,W*.64,.20,0xe4a542,false)
 const g=new T.BufferGeometry()
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3))
 g.computeVertexNormals();return g
}
export function fleetRenderer(parent,cars,citizens){
 const palette=[0x41697d,0xe6dcc9,0x945047,0x5a705d,0xa4abb3],groups=new Map(),dummy=new T.Object3D()
 const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.65})
 const scooters=new Map(),riders=[[],[]]
 const scooterCount=cars.filter(c=>types[c.type].name==='scooter').length
 for(const c of cars){
  if(types[c.type].name==='scooter'){c.batch=scooterBatch(c);continue}
  const k=c.type+','+c.paint
  if(!groups.has(k)){
   const geometry=c.type===4?body(types[4],0xf3e8cb):trafficModel(types[c.type],palette[c.paint])
   const mesh=new T.InstancedMesh(geometry,material,cars.filter(v=>v.type===c.type&&v.paint===c.paint).length)
   mesh.frustumCulled=false;mesh.count=0;parent.add(mesh);groups.set(k,mesh)
  }
  c.batch=groups.get(k)
 }
 function scooterBatch(c){
  if(scooters.has(c.paint))return scooters.get(c.paint)
  const geometry=trafficModel(types[c.type],scooterPaints[c.paint])
  const batch=new T.InstancedMesh(geometry,material,scooterCount)
  batch.frustumCulled=false;parent.add(batch);scooters.set(c.paint,batch);batch.count=0
  return batch
 }
 function createRider(index){
  const citizen=(index%2?citizens.female:citizens.male).spawn()
  const root=new T.Group();root.add(citizen.root)
  citizen.root.scale.setScalar(.94);citizen.root.position.set(-.29,.82,0)
  citizen.update(0,0,'scooter',0);root.updateMatrixWorld(true)
  const head=citizen.head.getWorldPosition(new T.Vector3())
  const shell=new T.Mesh(new T.SphereGeometry(1,28,18,0,Math.PI*2,0,Math.PI*.66),
   new T.MeshStandardMaterial({color:index%2?0x547484:0xd3cdc4,roughness:.31,side:T.DoubleSide}))
  shell.position.copy(head);shell.position.y+=.119
  shell.scale.set(.157,.158,.137);root.add(shell)
  const visor=new T.Mesh(new T.SphereGeometry(1,24,12,-Math.PI*.32,Math.PI*.64,Math.PI*.38,Math.PI*.24),new T.MeshStandardMaterial({color:0x39474d,side:T.DoubleSide}))
  visor.position.copy(shell.position);visor.scale.set(.162,.16,.14);visor.rotation.y=Math.PI;root.add(visor)
  const shirt={value:new T.Color()}
  citizen.root.traverse(mesh=>{
   if(!mesh.isSkinnedMesh||!mesh.material.name.endsWith('_body'))return
   mesh.material=mesh.material.clone()
   mesh.material.onBeforeCompile=shader=>{
    shader.uniforms.shirtColor=shirt
    shader.vertexShader='varying vec3 restPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrestPoint=position;')
    shader.fragmentShader='uniform vec3 shirtColor; varying vec3 restPoint;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float y=restPoint.y, x=abs(restPoint.x);
     float sleeve=1.0-smoothstep(.23,.32,x);
     float collar=1.0-smoothstep(1.39,1.49,y);
     float cloth=smoothstep(.91,1.0,y)*sleeve*collar;
     float weave=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
     diffuseColor.rgb=mix(diffuseColor.rgb,shirtColor*(.22+1.4*weave),cloth);`)
   }
  })
  parent.add(root);return {root,shirt,helmet:shell.material}
 }
 return function draw(near,pose,actor){
  const riderCount=[0,0]
  for(const mesh of scooters.values())mesh.count=0
  for(const mesh of groups.values())mesh.count=0
  for(const c of near){
   if(c.type===4&&(c.occupied||Math.hypot(c.x-actor.x,c.n+actor.z)<58))continue
   const p=pose(c);dummy.position.set(p.x,p.h+.025,-p.n);dummy.rotation.set(0,p.angle,p.slope,'YXZ');dummy.updateMatrix()
   let batch=c.batch
   if(types[c.type].name==='scooter'){
    batch=c.batch=scooterBatch(c)
    const style=Number(c.female),pool=riders[style],index=riderCount[style]++
    const rider=pool[index]??(pool[index]=createRider(style))
    rider.shirt.value.setHex(c.shirt);rider.helmet.color.setHex(c.helmet)
    rider.root.visible=true;rider.root.position.copy(dummy.position);rider.root.quaternion.copy(dummy.quaternion)
   }
   batch.setMatrixAt(batch.count++,dummy.matrix)
  }
  for(const [style,pool] of riders.entries())for(let i=riderCount[style];i<pool.length;i++)pool[i].root.visible=false
  for(const mesh of scooters.values())if(mesh.count)mesh.instanceMatrix.needsUpdate=true
  for(const mesh of groups.values())if(mesh.count)mesh.instanceMatrix.needsUpdate=true
 }
}
