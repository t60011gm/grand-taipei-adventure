import {stopsByLane} from './bus-stops.js'

const clamp=t=>Math.max(0,Math.min(1,t))
function ease(t){t=clamp(t);return t*t*(3-2*t)}
export function stations(id,lane,point){
 return (stopsByLane[id]??[]).map(stop=>{
  let k=0,best=Infinity
  for(const [i,p] of lane.p.entries()){
   const d=Math.hypot(stop.x-p[0],stop.n-p[1])
   if(d<best){best=d;k=i}
  }
  const m=lane.s[k]-3.78,base=point(lane,m),sn=Math.sin(base.angle),cs=Math.cos(base.angle)
  const curb=stop.curbX!==undefined?(stop.curbX-base.x)*sn:(stop.curbN-base.n)*-cs
  const offset=Math.max(.35,curb-1.48)
  return {...stop,m,offset,h:base.h,angle:base.angle,
   poleX:base.x+3.78*cs+(offset+2.05)*sn,poleN:base.n+3.78*sn-(offset+2.05)*cs}
 }).filter(s=>s.m>0&&s.m<lane.length).sort((a,b)=>a.m-b.m)
}
export function resetService(bus){
 const index=bus.stations.findIndex(s=>s.m>=bus.m)
 Object.assign(bus,{index:index<0?bus.stations.length:index,state:'drive',timer:0,door:0,indicator:0,onboard:10,boarded:0,alighted:0})
}
export function busPose(bus,p,m){
 const s=bus.stations?.[bus.index]
 if(!s)return p
 const delta=m-s.m,span=delta<0?32:24,t=1-Math.abs(delta)/span
 const offset=s.offset*ease(t),yaw=p.angle
 const slope=(delta<0?1:-1)*s.offset*6*clamp(t)*(1-clamp(t))/span
 return {...p,x:p.x+Math.sin(yaw)*offset,n:p.n-Math.cos(yaw)*offset,angle:yaw-Math.atan(slope)}
}
function mergeClear(bus,player,cars){
 const a=bus.lane.p[bus.i-1],b=bus.lane.p[bus.i],yaw=Math.atan2(b[1]-a[1],b[0]-a[0])
 const cs=Math.cos(yaw),sn=Math.sin(yaw)
 function conflict(v){
  if(v===bus||v.wait||Math.abs(v.h-bus.h)>1.6)return false
  const x=v.x-a[0],n=v.n-a[1],d=x*cs+n*sn,side=x*sn-n*cs
  const half=(bus.length+(v.length??4.38))/2
  return Math.abs(side)<2.4&&d>-(half+1.3)&&d<half+2
 }
 return !conflict(player)&&!cars.some(conflict)
}
export function serviceLimit(bus,dt,player,cars){
 const stop=bus.stations[bus.index]
 if(!stop)return Infinity
 const remaining=stop.m-bus.m
 if(bus.state==='depart'){
  if(remaining<=-24){bus.index++;bus.state='drive';bus.indicator=0;bus.timer=0}
  return Infinity
 }
 if(remaining>.001){
  bus.state=remaining<32?'approach':'drive';bus.indicator=remaining<32?1:0
  return remaining
 }
 if(bus.state==='approach'||bus.state==='drive'){bus.state='dwell';bus.timer=0;bus.indicator=0;bus.pickup=stop.pgp!=='-1'&&bus.onboard<40;bus.dropoff=stop.pgp!=='1'&&bus.onboard>0}
 const before=bus.timer
 if(bus.passengerHold){bus.door=1;return 0}
 bus.timer+=dt
 const boardStart=bus.dropoff?4:1
 if(bus.dropoff&&before<4&&bus.timer>=4){bus.onboard--;bus.alighted++}
 if(bus.pickup&&before<boardStart+3&&bus.timer>=boardStart+3){bus.onboard++;bus.boarded++}
 const closeAt=bus.dropoff&&bus.pickup?7.5:4.5
 bus.door=Math.min(clamp(bus.timer),clamp(closeAt+1-bus.timer))
 if(bus.timer>=closeAt+1){
  bus.state='signal';bus.indicator=-1
  if(bus.timer>=closeAt+3&&mergeClear(bus,player,cars)){bus.state='depart';return Infinity}
 }
 return 0
}
