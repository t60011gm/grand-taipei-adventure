import {stations,resetService,busPose,serviceLimit} from './bus-service.js'
import {crossings,detector,walkOpen,phase,stopBarWidth,world} from './crossings.js'
import {types,randomizeScooter} from './fleet.js'
import {roadLimit} from './speed.js'
import {mainlineMovements} from './mainline.js'
export {phase}
import {path,point} from './lane-geometry.js'
export {path,point}
// Project nearby bumpers onto the upcoming polyline, including curved approaches.
function ahead(lane,m,i,q,buffer){
 let gap=Infinity
 for(let k=i;k<lane.p.length&&lane.s[k-1]<m+60;k++){
  const a=lane.p[k-1],b=lane.p[k],dx=b[0]-a[0],dn=b[1]-a[1],len=dx*dx+dn*dn
  if(!len)continue
  const f=((q.x-a[0])*dx+(q.n-a[1])*dn)/len
  if(f<0||f>1||Math.abs(q.h-a[2]-f*(b[2]-a[2]))>1.6)continue
  if(Math.hypot(q.x-a[0]-f*dx,q.n-a[1]-f*dn)>2.05)continue
  const d=lane.s[k-1]+f*(lane.s[k]-lane.s[k-1])-m
  if(d>0)gap=Math.min(gap,Math.max(0,d-buffer))
 }
 return gap
}
// Eastbound traffic shares the through lane up to the right turn into Dunhua South Road.
function dunhuaTurn(lane,entry){
 const j=entry.j,start=point(lane,entry.m+5)
 const u=(start.x-j.x)*j.cos+(start.n-j.n)*j.sin
 const v=-(start.x-j.x)*j.sin+(start.n-j.n)*j.cos
 const radius=7,points=lane.p.slice(0,start.i)
 for(let i=0;i<=24;i++){
  const angle=Math.PI*i/48
  const p=world(j,u+radius*Math.sin(angle),v-radius*(1-Math.cos(angle)))
  p[2]=start.h+(j.h-start.h)*i/24;points.push(p)
 }
 // Join the southbound carriageway from the same metre survey as map-roads.json.
 const end=points.at(-1)
 for(let d=1;d<=110;d++){
  const n=end[1]-d,t=Math.min(1,d/15),blend=t*t*(3-2*t)
  const x=2924.5+(n-262.3)*.5/105.6
  points.push([(end[0]+d*j.sin)*(1-blend)+x*blend,n,j.h])
 }
 const turn=path(points)
 turn.through=lane;turn.fork=entry.m+5
 return turn
}
export function createTraffic(city,demonstration=false){
 const walks=crossings(),events=detector(walks)
 const stopBars=[],stops=[],cars=[],buckets=new Map(),key=(x,n)=>Math.floor(x/60)+','+Math.floor(n/60)
 let time=0,interval=.075,carry=0,enabled=true,status=''
 function index(){
  buckets.clear()
  for(const c of cars){if(c.wait)continue
   const k=key(c.x,c.n);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c)
  }
 }
 const lanes=city.tourLanes
 const elevated=[
  ['新生北向','51362361','260152357'],['新生南向','50289495','1079151555','244450513'],
  ['建國北向','910567292','910567291'],['建國南向','910959595','252657373','252657374']
 ]
 const extra=new Map()
 for(const [name,...ids] of elevated){
  if(ids.every(id=>lanes[id]))extra.set(name,path(ids.flatMap(id=>lanes[id])))
 }
 let merge
 if(lanes.guangfuWest&&lanes.civic1){
  const ramp=path(lanes.guangfuWest),end=ramp.p.at(-1)
  const through=lanes.civic1.filter(p=>p[0]<end[0]).reverse()
  // Blend into the westbound lane over the painted taper.
  const joined=through.map(p=>{
   const t=Math.min(1,(end[0]-p[0])/36)
   return [p[0],p[1]+(end[1]-through[0][1])*(1-t*t*(3-2*t)),p[2]]
  })
  const lane=path([...ramp.p,...joined]);lane.mergeAt=ramp.length
  const main=path(lanes.civic1.slice().reverse())
  const ix=main.p.findIndex(p=>p[0]<=end[0])
  merge={...point(main,main.s[ix]),mainAt:main.s[ix],lane};extra.set('光復西向匯入',lane)
 }
 // Each entry has its own receiving carriageway, including the two levels
 // of the interchange. Measure approaching traffic along that carriageway.
 const entries=new Map()
 for(const [id,mainId] of [
  ['51362366','civic1'],['49073263','civic-1'],['1132433053','新生北向'],
  ['1132431141','新生南向'],['49073297','建國北向'],['49710834','建國南向']
 ]){
  if(!lanes[id])continue
  const main=extra.get(mainId)??(lanes[mainId]&&path(mainId==='civic1'?lanes[mainId].slice().reverse():lanes[mainId]))
  if(!main)continue
  const end=lanes[id].at(-1)
  let best=Infinity,station=0
  for(let i=1;i<main.p.length;i++){
   const a=main.p[i-1],b=main.p[i],dx=b[0]-a[0],dn=b[1]-a[1],sq=dx*dx+dn*dn
   if(!sq)continue
   const t=Math.max(0,Math.min(1,((end[0]-a[0])*dx+(end[1]-a[1])*dn)/sq))
   const d=Math.hypot(a[0]+t*dx-end[0],a[1]+t*dn-end[1],a[2]+t*(b[2]-a[2])-end[2])
   if(d<best){best=d;station=main.s[i-1]+t*(main.s[i]-main.s[i-1])}
  }
  entries.set(id,{mainId,station,end})
 }
 for(const id of ['civic-1','civic1','tourSurface-1','tourSurface1','GFsurfaceG1','GFsurfaceG-1','GFsurfaceC1','GFsurfaceC-1','GFsurfaceB',...extra.keys()]){
  const p=city.tourLanes[id];if(!p&&!extra.has(id))continue
  const lane=extra.get(id)??path(['civic1','tourSurface1','GFsurfaceC1','GFsurfaceG-1'].includes(id)?p.slice().reverse():p)
  lane.id=id
  if(!id.startsWith('civic'))for(const e of events(lane)){
   if(e.c)continue
   const p=point(lane,e.m)
   if(!stopBars.some(b=>Math.hypot(b.x-p.x,b.n-p.n)<1&&Math.cos(b.angle-p.angle)>.9))
    stopBars.push({...p,j:e.j})
  }
  const routeStops=stations(id,lane,point);stops.push(...routeStops)
  const entry=id==='tourSurface-1'&&events(lane).find(e=>!e.c&&e.j.name.includes('敦化'))
  const turn=entry&&dunhuaTurn(lane,entry)
  if(turn){
   turn.entry=entry.m
   turn.exitWalk=events(turn).find(e=>e.j===entry.j&&e.c&&!e.c.ns&&e.c.line<0)?.c
  }
  for(let m=32;m<lane.length-5;m+=115){
   if(lane===merge?.lane&&m>lane.mergeAt-50)break
   const seq=Math.floor((m-32)/115)
   const surface=id.startsWith('tourSurface')||id.startsWith('GFsurface')
   const type=routeStops.length&&seq%8===0?4:surface&&seq%3===1?5:seq%4
   const length=types[type].length,cruise=(roadLimit(id,extra.has(id)?'cross':'surface',id)+(cars.length*7)%11-5)/3.6
   cars.push({stations:type===4?routeStops:null,type,length,lane,m,previous:m,paint:cars.length%5,cruise,v:cruise,wait:false,...point(lane,m)})
   if(turn&&type<4&&seq%2===0){
    const c=cars.at(-1);c.turn=turn
    if(m<turn.fork)c.lane=turn
   }
   if(type===4)resetService(cars.at(-1))
   if(type===5)randomizeScooter(cars.at(-1))
  }
  if(turn){
   // Populate the new turning movement with a car on its first approach.
   const m=entry.m-12
   if(cars.every(c=>(c.lane.through??c.lane)!==lane||Math.abs(c.m-m)>(c.length+types[0].length)/2+5))
    cars.push({type:0,length:types[0].length,lane:turn,turn,m,previous:m,paint:2,cruise:11,v:5,wait:false,...point(turn,m)})
  }
 }
 const movements=mainlineMovements(lanes)
 for(const movement of movements){
  const lane=movement.lane,m=0
  const car={lane,type:1,length:types[1].length,paint:2,m,previous:m,v:8,cruise:10,wait:false,...point(lane,m)}
  movement.car=car
  cars.push(car)
 }
 // Stage repeatable starting positions only when a new demonstration leg begins.
 // From that point the three vehicles use their normal traffic controllers.
 function stage(id){
  if(!demonstration)return
  const move=movements.find(m=>m.id===id)
  if(!move)return
  const start=move.leg.mainStart,own=cars.filter(c=>c.lane.id===id)
  const follower=own[0]
  function place(car,m,v){
   Object.assign(car,point(car.lane,m),{m,previous:m,v,wait:false,braking:false})
  }
  for(const c of own)if(c!==follower&&c.m>=start-100&&c.m<move.at+150)c.wait=true
  place(follower,start-42,move.leg.startSpeed)
  place(move.car,Math.max(0,move.mergeAt-95),6)
  move.follower=follower
  index()
 }
 index()
 function limits(lane,m,i,v,self,player){
  const a=lane.p[i-1],length=self?.length??4.38
  let light=Infinity,ped=Infinity
  for(const e of events(lane)){
   const nose=e.m-m-length/2
   if(nose<-.001||nose>112)continue
   const d=Math.max(0,nose-(e.c?2:stopBarWidth/2+.9))
   if(e.c){if(e.c.active||e.c.player)ped=Math.min(ped,Math.max(0,d));continue}
   const color=phase(time,e.j.id,e.ns)
   if(color==='red'||(color==='amber'&&d>=v*v/7))light=Math.min(light,Math.max(0,d))
  }
  // A queued right-turner can see the occupied exit crossing before entering
  // the junction. Keep the approach zebra clear while waiting for that walker.
  if(lane.exitWalk?.active||lane.exitWalk?.player){
   const nose=lane.entry-m-length/2
   if(nose>=0&&nose<=112)ped=Math.min(ped,Math.max(0,nose-stopBarWidth/2-.9))
  }
  let gap=Infinity,busGap=Infinity
  function check(c){
   if(c===self||Math.hypot(c.x-a[0],c.n-a[1])>65)return
   const buffer=(length+(c.length??4.38))/2+3
   // Keep a reservation in the through lane until the rear of the departing bus clears it.
   const serving=c.type===4&&c.state!=='drive'
   const reserved=serving?point(c.lane,c.m):c
   const space=buffer+(serving?2:0)
   const shared=(lane.through??lane)===(c.lane?.through??c.lane)&&
    (!lane.through||m<lane.fork)&&(!c.lane?.through||c.m<c.lane.fork)
   const d=c.lane===lane||shared?(c.m>m?Math.max(0,c.m-m-space):Infinity):ahead(lane,m,i,reserved,space)
   gap=Math.min(gap,d)
   if(serving)busGap=Math.min(busGap,d)

  }
  for(const dx of [-60,0,60])for(const dn of [-60,0,60]){
   const near=buckets.get(key(a[0]+dx,a[1]+dn));if(near)near.forEach(check)
  }
  if(player)check(player)
  let yieldDistance=Infinity
  const entry=entries.get(lane.id)
  if(entry){
   const end=lane.p.at(-1),remaining=lane.length-m
   if(remaining>8&&remaining<72&&Math.hypot(end[0]-entry.end[0],end[1]-entry.end[1])<6){
    const conflict=cars.some(c=>{
     if(c.wait||c.lane.id!==entry.mainId)return false
     const d=entry.station-c.m
     return d>-(c.length+length)/2-3&&d<Math.max(16,c.v*4.8)
    })
    if(conflict)yieldDistance=Math.max(0,remaining-15)
   }
  }
  if(merge&&(lane===merge.lane||lane.id==='guangfuWest')){
   const remaining=(lane.mergeAt??lane.length)-m
   if(remaining>8&&remaining<56){
    // Reserve a slot before entering the taper. Ignore traffic on other levels
    // and the vehicles already queuing on the ramp.
    const ux=Math.cos(merge.angle),un=Math.sin(merge.angle)
    const arrival=(remaining+6)/Math.max(v,6)
    const conflicts=c=>{
     if(c===self||c.wait||c.lane===merge.lane||c.roadId==='guangfuWest'||Math.abs(c.h-merge.h)>1.4)return false
     const dx=merge.x-c.x,dn=merge.n-c.n,along=dx*ux+dn*un
     const d=c.lane?.id==='civic1'?merge.mainAt-c.m:along
     return d>-5&&d<100&&(c.lane?.id==='civic1'||Math.abs(dx*un-dn*ux)<2.5)&&
      Math.cos((c.angle??merge.angle)-merge.angle)>.85&&d/Math.max(2,c.v??0)<Math.min(5,arrival+2)
    }
    if(cars.some(conflicts)||(player&&conflicts(player)))yieldDistance=Math.max(0,remaining-10)
   }
  }
  // A ramp driver must still yield if a through car is already alongside.
  // A more distant through driver can open a slot without stopping either lane.
  const ownEntry=self&&movements.find(move=>move.car===self)
  if(ownEntry){
   const remaining=ownEntry.mergeAt-m
   if(remaining>4&&remaining<75){
    const occupied=c=>{
     if(c.wait||c===self)return false
     let distance
     if(c.lane?.id===ownEntry.id)distance=ownEntry.at-c.m
     else if(!c.lane&&(c.roadId===ownEntry.id||ownEntry.mainIds.includes(c.roadId))){
      const dx=ownEntry.join.x-c.x,dn=ownEntry.join.n-c.n
      distance=dx*Math.cos(ownEntry.join.angle)+dn*Math.sin(ownEntry.join.angle)
     }else return false
     return distance>-8&&distance<remaining+9&&distance<Math.max(20,(c.v??0)*4.6)
    }
    if(cars.some(occupied)||(player&&occupied(player)))yieldDistance=Math.min(yieldDistance,Math.max(0,remaining-21))
   }
  }
  let courtesy=Infinity
  for(const move of movements){
   const entering=move.car
   if(self===entering||entering.wait||entering.m>move.mergeAt+5)continue
   const remaining=move.mergeAt-entering.m
   if(remaining>92)continue
   const dx=move.join.x-a[0],dn=move.join.n-a[1],co=Math.cos(move.join.angle),sn=Math.sin(move.join.angle)
   const station=lane.mainStart!==undefined?lane.mainStart+m:m
   const sameLane=lane.id===move.id
   const distance=sameLane?move.at-station:dx*co+dn*sn
   if(!sameLane&&!move.mainIds.includes(lane.id))continue
   if(!sameLane&&(Math.abs(dx*sn-dn*co)>2.2||Math.abs(a[2]-move.join.h)>1.2||
    Math.cos(Math.atan2(lane.p[i][1]-a[1],lane.p[i][0]-a[0])-move.join.angle)<.93))continue
   if(distance<5||distance>145||distance<remaining+7)continue
   // Spread the speed change across the approach and leave a two-second slot.
   const target=Math.max(3,(distance-8)/(Math.max(0,remaining)/Math.max(5,entering.v)+2.4))
   courtesy=Math.min(courtesy,target)
  }
  return {distance:Math.min(light,ped,gap,yieldDistance),speed:Math.min(courtesy,Math.sqrt(6*Math.min(light,ped)),yieldDistance<Infinity?Math.min(5.5,Math.sqrt(5*yieldDistance)):Infinity,gap/1.8),reason:courtesy<Math.min(gap/1.8,Math.sqrt(6*Math.min(light,ped)))&&yieldDistance===Infinity?'主線減速留空間':yieldDistance<Math.min(light,ped,gap)?'匯入前讓車':ped<light&&ped<gap?'停讓行人':light<gap?'等候號誌':busGap===gap&&gap<Infinity?'禮讓停靠公車':'保持跟車距離'}
 }
 function tick(dt,player){
  if(!enabled)return
  time+=dt;carry+=dt
  if(carry<.075)return
  const step=carry;interval=step;carry=0
  for(const c of walks){
   if(!c.active&&walkOpen(time,c)){
    const cycle=Math.floor((time+c.j.id*13+(c.ns?0:(c.j.id<3?30:48)))/(c.j.id<3?60:96))
    if(cycle!==c.cycle){
     // Do not step into a vehicle which has already entered the crossing.
     const ux=(c.b[0]-c.a[0])/c.length,un=(c.b[1]-c.a[1])/c.length
     function obstructs(v){
      const dx=v.x-c.a[0],dn=v.n-c.a[1],along=dx*ux+dn*un
      return Math.abs(v.h-c.j.h)<1.5&&along>-2&&along<c.length+2&&Math.abs(dx*un-dn*ux)<(v.length??4.38)/2+2
     }
     if(!obstructs(player)&&!cars.some(v=>!v.wait&&obstructs(v))){c.cycle=cycle;c.active=true}
    }
   }
   if(c.active){
    c.at=Math.max(0,Math.min(c.length,c.at+step*c.speed*c.dir))
    if(c.at===0||c.at===c.length){c.active=false;c.dir*=-1}
   }
  }
  const desired=cars.map(c=>limits(c.lane,c.m,c.i,c.v,c,player))
  for(const [idx,c] of cars.entries()){
   if(c.wait){
    const start=point(c.lane,0)
    if(Math.hypot(start.x-player.x,start.n-player.n)<85||cars.some(other=>other!==c&&!other.wait&&(other.lane.through??other.lane)===(c.lane.through??c.lane)&&other.m<24))continue
    if(c.turn)c.lane=c.turn
    c.m=c.previous=0;c.v=0;c.wait=false;Object.assign(c,start);if(c.type===4)resetService(c);if(c.type===5)randomizeScooter(c);continue
   }
   const lim=desired[idx],stop=c.type===4?serviceLimit(c,step,player,cars):Infinity
   const corner=c.lane.through&&Math.abs(c.m-c.lane.fork)<16?4:Infinity
   const entering=movements.find(m=>m.car===c)
   const cruise=entering?(c.m<entering.mergeAt?10:16):c.lane===merge?.lane?(c.m<c.lane.mergeAt?40:78)/3.6:c.cruise
   const target=Math.min(corner,cruise,lim.speed,Math.sqrt(4*stop))
   const previousSpeed=c.v
   c.v+=Math.max(-(lim.reason==='主線減速留空間'?1.7:4)*step,Math.min(2.4*step,target-c.v))
   const move=Math.min(c.v*step,lim.distance,stop)
   c.previous=c.m;c.v=move/step;c.braking=(previousSpeed-c.v)/step>.45||(c.v<.15&&target<.15);c.m=Math.min(c.lane.length,c.m+move);const position=point(c.lane,c.m);Object.assign(c,c.type===4?busPose(c,position,c.m):position)
   if(c.m>=c.lane.length)c.wait=true
  }
  index()
 }
 return {cars,walks,stops,stopBars,tick,stage,movements,get time(){return time},get enabled(){return enabled},get status(){return status},
  get fraction(){return Math.min(1,carry/interval)},
  clearOverlap(player){
   for(const c of cars)if(Math.abs(c.h-player.h)<1.6&&Math.hypot(c.x-player.x,c.n-player.n)<(c.length+4.38)/2+3)c.wait=true
   index()
  },
  setEnabled(value){enabled=value;status=''},
  guide(lane,m,i,v){const lim=limits(lane,m,i,v);status=lim.speed<Math.max(2,v+1)?lim.reason:'';return lim}}
}
