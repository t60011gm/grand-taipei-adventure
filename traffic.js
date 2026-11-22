import {stations,resetService,busPose,serviceLimit} from './bus-service.js'
import {crossings,detector,walkOpen,phase,stopBarWidth,world} from './crossings.js'
import {types,randomizeScooter} from './fleet.js'
import {roadLimit} from './speed.js'
export {phase}
export function path(points){
 const p=[points[0]],s=[0]
 for(const b of points.slice(1)){
  const a=p.at(-1),d=Math.hypot(...a.map((v,i)=>b[i]-v))
  if(d>.001){p.push(b);s.push(s.at(-1)+d)}
 }
 return {p,s,length:s.at(-1)}
}
export function point(lane,m){
 const {p,s}=lane
 let lo=0,hi=s.length-1
 while(hi-lo>1){const k=(lo+hi)>>1;if(s[k]<=m)lo=k;else hi=k}
 const a=p[lo],b=p[hi],f=Math.min(1,Math.max(0,(m-s[lo])/(s[hi]-s[lo])))
 return {x:a[0]+(b[0]-a[0])*f,n:a[1]+(b[1]-a[1])*f,h:a[2]+(b[2]-a[2])*f,
  angle:Math.atan2(b[1]-a[1],b[0]-a[0]),slope:Math.atan2(b[2]-a[2],Math.hypot(b[0]-a[0],b[1]-a[1])),i:hi}
}
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
export function createTraffic(city){
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
  return {distance:Math.min(light,ped,gap,yieldDistance),speed:Math.min(Math.sqrt(6*Math.min(light,ped)),yieldDistance<Infinity?Math.min(8,Math.sqrt(5*yieldDistance)):Infinity,gap/1.8),reason:yieldDistance<Math.min(light,ped,gap)?'匯入前讓車':ped<light&&ped<gap?'停讓行人':light<gap?'等候號誌':busGap===gap&&gap<Infinity?'禮讓停靠公車':'保持跟車距離'}
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
   const cruise=c.lane===merge?.lane?(c.m<c.lane.mergeAt?40:78)/3.6:c.cruise
   const target=Math.min(corner,cruise,lim.speed,Math.sqrt(4*stop))
   const previousSpeed=c.v
   c.v+=Math.max(-4*step,Math.min(2.4*step,target-c.v))
   const move=Math.min(c.v*step,lim.distance,stop)
   c.previous=c.m;c.v=move/step;c.braking=(previousSpeed-c.v)/step>.45||(c.v<.15&&target<.15);c.m=Math.min(c.lane.length,c.m+move);const position=point(c.lane,c.m);Object.assign(c,c.type===4?busPose(c,position,c.m):position)
   if(c.m>=c.lane.length)c.wait=true
  }
  index()
 }
 return {cars,walks,stops,stopBars,tick,get time(){return time},get enabled(){return enabled},get status(){return status},
  get fraction(){return Math.min(1,carry/interval)},
  clearOverlap(player){
   for(const c of cars)if(Math.abs(c.h-player.h)<1.6&&Math.hypot(c.x-player.x,c.n-player.n)<(c.length+4.38)/2+3)c.wait=true
   index()
  },
  setEnabled(value){enabled=value;status=''},
  guide(lane,m,i,v){const lim=limits(lane,m,i,v);status=lim.speed<Math.max(2,v+1)?lim.reason:'';return lim}}
}
