import {installBusService} from './bus-scene.js'
import {busPose} from './bus-service.js'
import * as T from './vendor/three.js'
import {path,point} from './traffic.js'
import {axis,intersections,phase,world,walkOpen,stopBarWidth} from './crossings.js'
import {fleetRenderer} from './fleet-scene.js'

export function installTraffic(scene,traffic,city,game,vehicle,citizens){
 const group=new T.Group();scene.add(group)
 const lamps=[],walkerPool=[],walkers=[],pedLights=[]
 const sites=intersections.map(()=>{const g=new T.Group();group.add(g);return g})
 const colors=[0xff3326,0xffba32,0x51ff85].map(active=>[0x202323,active].map(color=>new T.MeshBasicMaterial({color})))
 const disc=new T.CircleGeometry(.193,18)
 function head(x,y,rotation,id,ns){
  const holder=new T.Group();sites[id].add(holder);holder.position.set(x,intersections[id].h+5.32,-y);holder.rotation.y=rotation
  const bulbs=colors.map((pair,i)=>{
   const b=new T.Mesh(disc,pair[0]);b.position.x=(i-1)*.5*(ns&&rotation===Math.PI?-1:1);holder.add(b);return b
  })
  lamps.push({id,ns,bulbs})
  return holder
 }
 for(const [y,offset,sign,id] of [[643,6.78,1,2],[675,-6.8,-1,2],[503,6.8,1,1],[483,-6.8,-1,1],[337,6.9,1,0],[303,-6.6,-1,0]])
  head(axis(y)+offset,y-sign*.244,sign===1?0:Math.PI,id,true)
 const metal=new T.MeshStandardMaterial({color:0x414c4d})
 for(const j of intersections)for(const ns of j.id<3?[false]:[false,true])for(const dir of [-1,1]){
  const [x,n]=ns?world(j,dir*(j.half-4),dir*(j.width+1)):world(j,dir*j.half,-dir*(j.width-4))
  const h=head(x,n,j.angle+(ns?(dir===1?0:Math.PI):-dir*Math.PI/2),j.id,ns)
  const housing=new T.Mesh(new T.BoxGeometry(1.8,.58,.32),metal);housing.position.z=-.18;h.add(housing)
  const pole=new T.Mesh(new T.CylinderGeometry(.085,.10,5.35,10),metal);pole.position.set(6,-2.66,-.18);h.add(pole)
  const arm=new T.Mesh(new T.BoxGeometry(6,.14,.15),metal);arm.position.set(3,.17,-.18);h.add(arm)
 }
 const stripe=new T.MeshBasicMaterial({color:0xe3e1d8,polygonOffset:true,polygonOffsetFactor:-2})
 const plane=new T.PlaneGeometry(1,1),dummy=new T.Object3D()
 for(const bar of traffic.stopBars){
  const paint=new T.Mesh(plane,stripe)
  paint.position.set(bar.x,bar.h+.052,-bar.n)
  paint.rotation.set(-Math.PI/2,bar.angle,0,'YXZ')
  paint.scale.set(stopBarWidth,3.25,1);sites[bar.j.id].add(paint)
 }
 function pedIcon(color,walking){
  const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64
  const ctx=canvas.getContext('2d');ctx.fillStyle='#172221';ctx.fillRect(0,0,48,64)
  ctx.strokeStyle=ctx.fillStyle=color;ctx.lineWidth=5;ctx.lineCap='round'
  ctx.beginPath();ctx.arc(24,13,5,0,Math.PI*2);ctx.fill()
  const lines=walking?[[24,22,22,37],[22,37,12,51],[22,37,33,51],[24,23,33,33],[24,23,14,34]]:[[24,22,24,38],[21,38,21,53],[27,38,27,53],[19,23,17,37],[29,23,31,37]]
  for(const [x,y,u,v] of lines){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke()}
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace
  return new T.MeshBasicMaterial({map,side:T.DoubleSide})
 }
 const pedMats=[pedIcon('#ff5148',false),pedIcon('#5dff96',true)]
 for(const c of traffic.walks){
  const {j,a,b}=c,angle=Math.atan2(b[1]-a[1],b[0]-a[0]),count=Math.floor((c.length-1)/1.05)
  const markings=new T.InstancedMesh(plane,stripe,count)
  for(let i=0;i<count;i++){
   const f=(i+1)/(count+1)
   dummy.position.set(a[0]+(b[0]-a[0])*f,j.h+.043,-a[1]-(b[1]-a[1])*f)
   dummy.rotation.set(-Math.PI/2,angle,0,'YXZ');dummy.scale.set(.48,2.7,1);dummy.updateMatrix();markings.setMatrixAt(i,dummy.matrix)
  }
  sites[j.id].add(markings)
  for(const [k,p] of [a,b].entries()){
   const x=p[0]-Math.sin(angle)*1.6,n=p[1]+Math.cos(angle)*1.6
   const post=new T.Mesh(new T.CylinderGeometry(.055,.065,2.5,8),metal);post.position.set(x,j.h+1.25,-n);sites[j.id].add(post)
   const lamp=new T.Mesh(new T.PlaneGeometry(.38,.52),pedMats[0]);lamp.position.set(x,j.h+2.35,-n)
   lamp.rotation.y=angle+(k===0?Math.PI/2:-Math.PI/2);sites[j.id].add(lamp);pedLights.push({c,lamp})
  }
 }
 function addWalk(points){
  const lane=path(points)
  if(lane.length<6)return
  walkers.push({lane,offset:lane.length*.27,speed:1.05+(walkers.length%5)*.12})
 }
 // Keep each patrol on a continuous, unobstructed section of pavement.
 function patrol(points){
  const route=path(points);let run=[]
  for(let m=0;m<=route.length;m+=1){
   const a=point(route,m)
   if(!intersections.some(j=>Math.abs(a.x-j.x)<j.half+5&&Math.abs(a.n-j.n)<j.width+5)&&game.valid(a.x,-a.n,.33))run.push([a.x,a.n,a.h])
   else{if(run.length>6)addWalk(run);run=[]}
  }
  if(run.length>6)addWalk(run)
 }
 for(const side of [-1,1])for(let i=18+(side+1)*12;i+29<city.routeProfile.length;i+=62){
  const p=[]
  for(let j=i;j<=i+28;j+=2){
   const a=city.routeProfile[j],curb=a[side<0?2:3],edge=a[side<0?4:5]
   if(edge-curb<1)break
   p.push([city.routeStart+j,a[0]+side*(curb+Math.min(1.5,(edge-curb)/2)),a[1]+.15])
  }
  if(p.length>1)patrol(p)
 }
 for(const r of city.transport.roads.filter(r=>r.id==='GFwalk1'||r.id==='GFwalk-1')){
  const lane=path(r.p)
  for(let m=3;m+24<lane.length;m+=42){
   const points=[]
   for(let j=m;j<=m+24;j+=2){const a=point(lane,j);points.push([a.x,a.n,a.h+.14])}
   patrol(points)
  }
 }
 const drawStops=installBusService(group,traffic,citizens)
 const drawCars=fleetRenderer(group,traffic.cars,citizens)
 return function draw(actor,dt){
  group.visible=traffic.enabled
  if(!group.visible)return
  for(const j of intersections)sites[j.id].visible=Math.hypot(actor.x-j.x,actor.z+j.n)<115
  for(const {c,lamp} of pedLights)if(sites[c.j.id].visible)lamp.material=pedMats[Number(walkOpen(traffic.time,c))]
  for(const l of lamps){if(!sites[l.id].visible)continue
   const state=phase(traffic.time,l.id,l.ns)
   l.bulbs.forEach((b,i)=>b.material=colors[i][Number(['red','amber','green'][i]===state)])
  }
  const distance=a=>Math.hypot(a.x-actor.x,a.n+actor.z)
  const near=traffic.cars.filter(c=>!c.wait&&distance(c)<100).sort((a,b)=>distance(a)-distance(b))
  drawCars(near,c=>{
   const m=c.previous+(c.m-c.previous)*traffic.fraction,p=point(c.lane,m)
   return c.type===4?busPose(c,p,m):p
  },actor)
  let count=0
  function person(x,h,n,angle,speed){
   const citizen=walkerPool[count]??(walkerPool[count]=(count%2?citizens.male:citizens.female).spawn())
   count++;if(!citizen.root.parent)group.add(citizen.root)
   citizen.root.visible=true;citizen.root.position.set(x,h,-n);citizen.root.rotation.y=angle
   citizen.update(dt,speed,false,0)
  }
  drawStops(actor,near,person)
  for(const c of traffic.walks){
   if(!sites[c.j.id].visible)continue
   const f=c.at/c.length,x=c.a[0]+(c.b[0]-c.a[0])*f,n=c.a[1]+(c.b[1]-c.a[1])*f
   if(Math.hypot(actor.x-x,actor.z+n)<45)person(x,c.j.h+.09,n,Math.atan2(c.b[1]-c.a[1],c.b[0]-c.a[0])+(c.dir<0?Math.PI:0),c.active?c.speed:0)
  }
  for(const w of walkers){
   const a=w.lane.p[0]
   if(Math.hypot(a[0]-actor.x,a[1]+actor.z)>80)continue
   const len=w.lane.length,m=(traffic.time*w.speed+w.offset)%(2*len),back=m>len
   const pos=point(w.lane,back?2*len-m:m)
   if(distance(pos)>55)continue
   person(pos.x,pos.h,pos.n,pos.angle+(back?Math.PI:0),w.speed)
  }
  for(let i=count;i<walkerPool.length;i++)walkerPool[i].root.visible=false
 }
}
