import {busPose} from './bus-service.js'
import {point} from './traffic.js'

export function vehicleFrame(bus,fraction=1){
 const m=bus.previous+(bus.m-bus.previous)*fraction
 return busPose(bus,point(bus.lane,m),m)
}
function world(b,f,r,h){
 const cs=Math.cos(b.angle),sn=Math.sin(b.angle)
 return {x:b.x+cs*f+sn*r,z:-b.n-sn*f+cs*r,roadHeight:b.h+h,yaw:-b.angle}
}
function local(b,p){
 const dx=p.x-b.x,dn=-p.z-b.n,cs=Math.cos(b.angle),sn=Math.sin(b.angle)
 return [dx*cs+dn*sn,dx*sn-dn*cs]
}
export function passengerService(flow,game){
 let lastExit=null,bus=null,phase='foot',queued=null,requested=null,elapsed=0,points=[],recent='',origin=null
 const seat=[1.4,-.74,.94],doorFront=3.78,doorMiddle=-.648
 function nearby(){
  if(!flow.enabled||game.riding||bus)return null
  return flow.stops.find(s=>Math.abs(s.h-(game.person.roadHeight??game.sample(game.person.x,1)))<1.8&&Math.hypot(s.poleX-game.person.x,s.poleN+game.person.z)<5)??null
 }
 function arrivals(stop){
  let best=null
  for(const c of flow.cars){
   if(c.type!==4||c.wait)continue
   const k=c.stations.indexOf(stop)
   if(k<0||k<c.index||k===c.index&&['signal','depart'].includes(c.state))continue
   const d=Math.max(0,stop.m-c.m),open=c.state==='dwell'&&k===c.index
   const seconds=open?0:Math.ceil(d/Math.max(3,.65*c.cruise+Math.min(c.v,c.cruise)*.18)+(k-c.index)*10)
   if(!best||seconds<best.seconds)best={c,seconds,open}
  }
  return best
 }
 function next(){
  if(!bus)return null
  return bus.stations.slice(bus.index).find(s=>s!==origin&&s.pgp!=='1'&&!(s===bus.stations[bus.index]&&['depart','signal'].includes(bus.state)))??null
 }
 function bell(target=next()){
  if(phase!=='ride'||!target||target.pgp==='1')return
  requested=target
 }
 function canBoard(s){
  return s.pgp!=='-1'&&flow.cars.some(c=>c.stations?.includes(s)&&c.stations.slice(c.stations.indexOf(s)+1).some(stop=>stop.pgp!=='1'))
 }
 function action(){
  if(bus){bell();return}
  const s=nearby()
  if(s&&canBoard(s)){queued=queued===s?null:s;recent=''}
 }
 function transition(name,nodes){
  phase=name;points=nodes;elapsed=0;bus.passengerHold=true
 }
 function clearPavement(b,nodes){
  const stop=b.stations[b.index]
  for(let i=1;i<nodes.length;i++){
   const a=nodes[i-1],z=nodes[i],steps=Math.max(1,Math.ceil(Math.hypot(z[0]-a[0],z[1]-a[1])/.15))
   for(let k=0;k<=steps;k++){
    const p=world(b,a[0]+(z[0]-a[0])*k/steps,a[1]+(z[1]-a[1])*k/steps,.15)
    if(!game.valid(p.x,p.z,.27)||Math.hypot(p.x-stop.poleX,p.z+stop.poleN)<.32)return false
   }
  }
  return true
 }
 function landing(b){
  for(const r of [2.35,2.05,2.7,3.1])for(const shift of [0,.55,-.55]){
   const end=[doorMiddle+shift,r,.15],p=world(b,...end)
   if(!clearPavement(b,[[doorMiddle,1.72],end])||!game.valid(p.x,p.z,.35)||!game.valid(p.x+.4*Math.cos(p.yaw),p.z+.4*Math.sin(p.yaw),.3))continue
   return end
  }
  return null
 }
 function tick(dt){
  if(!bus){
   if(!queued)return
   if(nearby()!==queued){queued=null;return}
   const a=arrivals(queued)
   if(!a?.open||a.c.door<.99||a.c.v>.02||a.c.onboard>=40)return
   const b=a.c,[f,r]=local(b,game.person)
   if(r<1.55||Math.abs(f-doorFront)>5){recent='請走到站牌旁的人行道候車';return}
   const front=[doorFront,1.7,.15]
   const pavement=[f,doorFront+1,doorFront-1].map(v=>[[f,r,.15],[v,r,.15],[v,1.7,.15],front]).find(nodes=>clearPavement(b,nodes))
   if(!pavement){recent='請沿人行道移至前門旁';return}
   bus=b;bus.occupied=true;origin=queued;queued=null;recent=''
   transition('board',[...pavement,[doorFront,0,.48],[seat[0],0,.48],seat])
  }
  if(phase==='ride'){
   const s=bus.stations[bus.index]
   if(s&&s!==origin&&s.pgp!=='1'&&(s===requested||s===bus.stations.at(-1))&&bus.state==='dwell'&&bus.door>=.99){
    const end=landing(bus)
    if(end)transition('exit',[seat,[seat[0],0,.48],[doorMiddle,0,.48],[doorMiddle,1.72,.15],end])
   }
  }
  if(phase==='ride'){Object.assign(game.person,world(bus,...seat));return}
  if(!bus)return
  elapsed+=dt*1.7
  let distance=elapsed
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],len=Math.hypot(...a.map((v,k)=>v-b[k]))
   if(distance<len){
    Object.assign(game.person,world(bus,...a.map((v,k)=>v+(b[k]-v)*distance/len)))
    game.person.yaw=-bus.angle+Math.atan2(b[1]-a[1],b[0]-a[0]);return
   }
   distance-=len
  }
  Object.assign(game.person,world(bus,...points.at(-1)));bus.passengerHold=false
  if(phase==='board'){phase='ride';bus.onboard++;return}
  lastExit=bus.stations[bus.index];bus.onboard--;recent='已在'+bus.stations[bus.index].name+'下車 · 可繼續步行'
  bus.occupied=false;bus=null;phase='foot';requested=null;origin=null
  game.person.roadHeight=null;game.person.roadId=null
 }
 function reset(){
  if(bus){bus.passengerHold=false;bus.occupied=false;if(phase!=='board')bus.onboard--}
  bus=null;queued=null;requested=null;origin=null;lastExit=null;phase='foot';recent=''
 }
 return {nearby,arrivals,canBoard,next,bell,action,tick,reset,get bus(){return bus},get phase(){return phase},get queued(){return queued},get requested(){return requested},get recent(){return recent},get lastExit(){return lastExit},
  ridePose(){return world(vehicleFrame(bus,flow.fraction),...seat)}}
}
