import {coach,doorLeaf} from './passenger-cabin.js'
import * as T from './vendor/three.js'
import {busPose} from './bus-service.js'
import {point} from './traffic.js'
const surface=color=>new T.MeshStandardMaterial({color,roughness:.7})
function board(lines,colors,background){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=lines.length===1?72:256
 const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height)
 ctx.textAlign='center';ctx.textBaseline='middle'
 lines.forEach((line,i)=>{
  ctx.font='bold '+(lines.length===1?56:i===1?49:54)+'px sans-serif'
  ctx.fillStyle=colors[i];ctx.fillText(line,256,(i+.5)*canvas.height/lines.length,490)
 })
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace
 return new T.MeshBasicMaterial({map,side:T.DoubleSide})
}
function coachGraphics(){
 const root=new T.Group()
 function decal(w,h,x,y,z,angle,paint){
  const cv=document.createElement('canvas');cv.width=1024;cv.height=Math.round(1024*h/w)
  const ctx=cv.getContext('2d');ctx.scale(cv.width/1024,cv.height/192);paint(ctx)
  const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4
  const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}))
  mesh.position.set(x,y,z);mesh.rotation.y=angle;root.add(mesh)
 }
 for(const side of [-1,1]){
  decal(1.68,.32,1.05,.84,1.233*side,side>0?0:Math.PI,ctx=>{
   ctx.fillStyle='#126561';ctx.beginPath();ctx.moveTo(0,148);ctx.bezierCurveTo(45,106,89,21,193,18);ctx.lineTo(156,55);ctx.bezierCurveTo(100,65,83,123,35,148);ctx.fill()
   ctx.fillStyle='#dd9856';ctx.beginPath();ctx.moveTo(44,159);ctx.quadraticCurveTo(124,142,183,62);ctx.quadraticCurveTo(164,143,74,166);ctx.fill()
   ctx.fillStyle='#164c4f';ctx.font='bold 80px sans-serif';ctx.fillText('低地板公車',217,99);ctx.font='bold 35px sans-serif';ctx.fillText('TAIPEI  CITY  BUS',223,152)
  })
 }
 decal(.40,.13,5.398,.77,0,Math.PI/2,ctx=>{
  ctx.fillStyle='#f4f3df';ctx.fillRect(0,0,1024,192);ctx.fillStyle='#283336';ctx.font='bold 151px monospace';ctx.fillText('GTA-669',70,151)
 })
 return root
}
export function installBusService(group,traffic,citizens){
 const leaf=doorLeaf(),graphics=coachGraphics()
 const boards=[],buses=new Map(),displays=new Map(),steel=surface(0x657579)
 const amber=new T.MeshBasicMaterial({color:0xffa223})
 for(const s of traffic.stops){
  const root=new T.Group();group.add(root);root.position.set(s.poleX,s.h,-s.poleN);root.rotation.y=s.angle
  const pole=new T.Mesh(new T.CylinderGeometry(.055,.065,2.65,8),steel);pole.position.y=1.32;root.add(pole)
  const panel=new T.Mesh(new T.PlaneGeometry(1.16,.65),board([s.route+' 公車',s.name,'往 '+s.destination],['#ffe16b','#ffffff','#dbf5ef'],'#165451'))
  panel.position.y=2.52;panel.rotation.y=-Math.PI/2;root.add(panel);boards.push(root)
 }
 function fittings(c){
  const {root,wheels}=coach();root.add(graphics.clone());group.add(root)
  const driver=citizens.male.spawn()
  driver.root.position.set(4.03,1.0,-.60);root.add(driver.root);driver.update(.1,0,true,0)
  const s=c.stations[0],text=s.route+'　'+s.destination
  if(!displays.has(text))displays.set(text,board([text],['#ffc557'],'#171c1a'))
  const face=displays.get(text).clone();face.side=T.FrontSide
  const sign=new T.Mesh(new T.PlaneGeometry(1.82,.32),face);sign.rotation.y=Math.PI/2
  sign.position.set(5.45,2.54,0);root.add(sign)
  const sideSign=sign.clone();sideSign.scale.set(.78,.72,1);sideSign.position.set(2.38,2.78,1.232);sideSign.rotation.y=0;root.add(sideSign)
  const rear=sign.clone();rear.position.set(-5.355,2.67,0);rear.rotation.y=-Math.PI/2;root.add(rear)
  const doors=[],lights=[]
  for(const x of [-.648,3.78])for(const side of [-1,1]){
   const mesh=leaf.clone();mesh.position.set(x+side*.278,1.59,1.24);root.add(mesh)
   doors.push({mesh,x,side})
  }
  for(const side of [-1,1])for(const x of [-5.42,5.42]){
   const mesh=new T.Mesh(new T.BoxGeometry(.10,.16,.18),amber);mesh.position.set(x,1.08,side*1.03);root.add(mesh);lights.push({mesh,side})
  }
  return {root,doors,lights,wheels}
 }
 return function draw(actor,near,person){
  for(const b of boards)b.visible=Math.hypot(b.position.x-actor.x,b.position.z-actor.z)<105
  for(const item of buses.values())item.root.visible=false
  for(const c of near){
   if(c.type!==4||(!c.occupied&&Math.hypot(c.x-actor.x,c.n+actor.z)>=58))continue
   if(!buses.has(c))buses.set(c,fittings(c))
   const item=buses.get(c),m=c.previous+(c.m-c.previous)*traffic.fraction,p=busPose(c,point(c.lane,m),m)
   item.root.visible=true;item.root.position.set(p.x,p.h+.025,-p.n);item.root.rotation.set(0,p.angle,p.slope,'YXZ')
   for(const {wheel,side} of item.wheels)wheel.rotation.z=-side*m/.48
   for(const {mesh,x,side} of item.doors)mesh.position.x=x+side*(.278+.56*c.door)
   for(const {mesh,side} of item.lights)mesh.visible=c.indicator===side&&traffic.time%.84<.42
   const stop=c.stations[c.index]
   if(c.passengerHold||!stop||Math.hypot(stop.poleX-actor.x,stop.poleN+actor.z)>45)continue
   // The threshold lies just inside the dark doorway. A passenger is hidden once aboard.
   const cs=Math.cos(stop.angle),sn=Math.sin(stop.angle)
   function passenger(forward,right,out,speed){
    person(stop.poleX+forward*cs+right*sn,stop.h+.12,stop.poleN+forward*sn-right*cs,stop.angle+(out?-1:1)*Math.PI/2,speed)
   }
   if((c.state==='approach'&&stop.pgp!=='-1'||c.state==='dwell'&&c.pickup)){
    const start=c.dropoff?4:1,f=Math.max(0,(c.timer-start)/3)
    if(f<1)passenger(-.6*(1-f),1.3-2.28*f,false,f>0?1:0)
   }
   if(c.dropoff&&['dwell','signal','depart'].includes(c.state)&&c.timer>=1){
    const f=Math.min(1,(c.timer-1)/3)
    const walkAway=c.state==='depart'?Math.max(0,c.m-stop.m)*.28:0
    passenger(-4.43-f*.8-walkAway,-.96+f*2.65,true,f<1||walkAway>0?1:0)
   }
  }
 }
}
