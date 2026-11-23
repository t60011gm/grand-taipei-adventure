import {roadLimit,cruiseSpeed} from "./speed.js"
// A guided playback uses the same metre coordinates and deck heights as the road meshes.
const roadKinds=['main','cross','ramp','surface','parking','fork','lot']
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])
function segment(road,points){
 const p=[points[0]],s=[0]
 for(const point of points.slice(1)){
  const d=distance(p.at(-1),point)
  if(d>.001){p.push(point);s.push(s.at(-1)+d)}
 }
 return {id:road.id,label:road.label,kind:road.kind,p,s,length:s.at(-1)}
}

export function planTour(city){
 const roads=city.transport.roads.filter(r=>roadKinds.includes(r.kind))
 for(const side of [-1,1])roads.push({id:'tourSurface'+side,label:'市民大道平面'+(side<0?'東行':'西行'),kind:'surface'})
 const legs=roads.map(r=>{
  let p=city.tourLanes[r.id].slice()
  if(r.kind==='parking'){
   // Reserve the vehicle nose clearance in front of the closed garage end.
   let trim=2.45
   while(p.length>1){
    const a=p.at(-2),b=p.at(-1),len=distance(a,b)
    if(len>trim){p[p.length-1]=b.map((v,i)=>v+(a[i]-v)*trim/len);break}
    p.pop();trim-=len
   }
  }
  if(r.id==='GFsurfaceC1'||r.id==='GFsurfaceG-1'||r.id==='civic1'||r.id==='tourSurface1'||(r.kind==='parking'&&!r.enter))p.reverse()
  const label=r.kind==='main'?'市民高架全線'+(r.id==='civic1'?'西行':'東行'):r.label
  return segment({...r,label},p)
 })
 // Follow recorded geometry between demonstrations where road ends meet at the same level.
 const nodes=[],owners=[],links=[],cells=new Map(),key=(x,y)=>Math.floor(x/12)+','+Math.floor(y/12)
 for(const leg of legs){
  leg.first=nodes.length
  for(const p of leg.p){
   const i=nodes.length;nodes.push(p);owners.push(leg);links.push([])
   if(i>leg.first){
    links[i-1].push(i)
    if(['lot','parking','fork'].includes(leg.kind))links[i].push(i-1)
   }
   const cell=key(...p);if(!cells.has(cell))cells.set(cell,[])
   cells.get(cell).push(i)
  }
  leg.last=nodes.length-1
 }
 for(const leg of legs)for(const i of [leg.first,leg.last]){
  const [x,y,h]=nodes[i]
  for(const dx of [-12,0,12])for(const dy of [-12,0,12])for(const j of cells.get(key(x+dx,y+dy))??[]){
   if(j>=leg.first&&j<=leg.last)continue
   const p=nodes[j]
   if(Math.abs(p[2]-h)>.20||distance(nodes[i],p)>11)continue
   // A link has to lead forward along both lanes. Merely overlapping in plan
   // does not make parallel lanes, opposite carriageways or decks a turn.
   function join(from,to){
    const before=nodes[Math.max(owners[from].first,from-1)],after=nodes[Math.min(owners[to].last,to+1)]
    if(before===nodes[from]||after===nodes[to])return
    const a=nodes[from],b=nodes[to],yaw=Math.atan2(a[1]-before[1],a[0]-before[0])
    const next=Math.atan2(after[1]-b[1],after[0]-b[0])
    if(Math.cos(next-yaw)<-.12)return
    const gap=Math.hypot(b[0]-a[0],b[1]-a[1])
    if(gap>.12){
     const across=Math.atan2(b[1]-a[1],b[0]-a[0])
     if(Math.min(Math.cos(across-yaw),Math.cos(across-next))<.42)return
     if(gap>2&&Math.max(Math.abs(Math.sin(across-yaw)),Math.abs(Math.sin(across-next)))*gap>3.5)return
     if(gap>2&&Math.abs(p[2]-h)/gap>.10)return
    }
    links[from].push(to)
   }
   join(i,j);join(j,i)
  }
 }
 const pending=new Set(legs),route=[]
 function visit(leg,transfer=false){
  route.push({...leg,transfer,visit:true});pending.delete(leg);return leg.last
 }
 let end=visit(legs.find(l=>l.id==='civic-1'))
 // Present both complete decks first. Their map boundaries have no modelled turnaround.
 end=visit(legs.find(l=>l.id==='civic1'),true)
 while(pending.size){
  const starts=new Map(Array.from(pending,l=>[l.first,l]))
  const parent=new Int32Array(nodes.length).fill(-1),queue=[end];parent[end]=end
  let next=null
  for(let k=0;k<queue.length&&!next;k++){
   const i=queue[k]
   if(starts.has(i)){next=starts.get(i);break}
   for(const j of links[i])if(parent[j]===-1){parent[j]=i;queue.push(j)}
  }
  if(next){
   const path=[];let i=next.first
   while(i!==end){path.push(i);i=parent[i]}
   path.push(end);path.reverse()
   let start=0
   for(let k=1;k<path.length;k++){
    const owner=owners[path[start]]
    if(k<path.length-1&&owners[path[k]]===owner)continue
    const points=path.slice(start,k+1).map(n=>nodes[n])
    const from=path[k-1],to=path[k],other=owners[to]
    if(owner!==other){
     const a=nodes[from],b=nodes[to],gap=distance(a,b)
     if(gap>.15){
      const prev=nodes[Math.max(owner.first,from-1)],after=nodes[Math.min(other.last,to+1)]
      const h1=Math.atan2(a[1]-prev[1],a[0]-prev[0]),h2=Math.atan2(after[1]-b[1],after[0]-b[0])
      points.pop()
      for(let t=.5/gap;t<1;t+=.5/gap){
       const v=1-t
       points.push([0,1].map(axis=>{
        const component=axis===0?Math.cos:Math.sin
        return (v*v*(1+2*t))*a[axis]+(t*t*(3-2*t))*b[axis]+gap*t*v*(v*component(h1)-t*component(h2))
       }).concat(a[2]+(b[2]-a[2])*t))
      }
      points.push(b)
     }
    }
    const via=segment({...owner,label:'銜接下一段 · '+owner.label},points)
    via.backing=['parking','fork','lot'].includes(owner.kind)&&path[start]>path[Math.max(start,k-1)]
    if(via.length>.001)route.push(via)
    start=k
   }
   end=visit(next)
  }else{
   for(const leg of pending)if(!next||distance(nodes[end],leg.p[0])<distance(nodes[end],next.p[0]))next=leg
   end=visit(next,true)
  }
 }
 return route
}

export function createTour(route){
 let i=0,m=0,j=1,speed=route[0].startSpeed??0,elapsedDistance=0,hold=0,completed=0,done=false
 const total=route.filter(l=>l.visit).length
 function pose(car,dt){
  const leg=route[i],p=leg.p
  while(j<p.length-1&&m>leg.s[j])j++
  const a=p[j-1],b=p[j],f=(m-leg.s[j-1])/(leg.s[j]-leg.s[j-1])
  car.x=a[0]+(b[0]-a[0])*f;car.z=-(a[1]+(b[1]-a[1])*f)
  car.roadHeight=a[2]+(b[2]-a[2])*f
  const direction=leg.backing?-1:1
  const yaw=Math.atan2(direction*(a[1]-b[1]),direction*(b[0]-a[0]))
  car.yaw=dt?car.yaw+Math.atan2(Math.sin(yaw-car.yaw),Math.cos(yaw-car.yaw))*(1-Math.exp(-dt*8)):yaw
  car.roadSlope=direction*(b[2]-a[2])/Math.max(.001,Math.hypot(b[1]-a[1],b[0]-a[0]))
  car.roadId=leg.id;car.roadProgress=m;car.v=direction*speed
 }
 function tick(car,dt,traffic){
  if(done)return
  if(hold>0){hold=Math.max(0,hold-dt);if(hold===0){speed=route[i].startSpeed??0;pose(car,0)}return}
  const leg=route[i],remaining=leg.length-m
  // Read the coming bend before steering. At normal cruise this looks about
  // a second ahead; short junctions and garage returns use the same rule.
  let bendLimit=cruiseSpeed(roadLimit(leg.id,leg.kind,leg.label),m)
  for(let k=j;k<leg.p.length-1&&leg.s[k]-m<Math.max(6,speed*(leg.startSpeed?2.6:1.35));k++){
   const a=leg.p[Math.max(0,k-3)],b=leg.p[k],c=leg.p[Math.min(leg.p.length-1,k+3)]
   const ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1])
   if(ab*bc<.00001)continue
   const cos=Math.max(-1,Math.min(1,((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/(ab*bc)))
   const curvature=2*Math.acos(cos)/(ab+bc)
   if(curvature>.01)bendLimit=Math.min(bendLimit,Math.sqrt(2.2/curvature+(leg.startSpeed?3.4:5)*Math.max(0,leg.s[k]-m-1)))
  }
  const stop=!route[i+1]||route[i+1].transfer
  const safety=traffic?.guide(leg,m,j,speed)
  const limit=Math.min(safety?.speed??Infinity,bendLimit,stop?Math.sqrt(2*3.8*remaining)+.15:Infinity)
  const deceleration=safety?.reason==='主線減速留空間'&&safety.speed<=bendLimit?1.7:leg.startSpeed&&remaining>50&&(!safety||safety.distance>10)?2.3:4.2
  speed+=Math.min(3.3*dt,Math.max(-deceleration*dt,limit-speed))
  const step=Math.min(safety?.distance??Infinity,remaining,speed*dt);if(step<speed*dt&&step<remaining)speed=step/dt;elapsedDistance+=step;m+=step;pose(car,dt)
  if(m>=leg.length){
   if(leg.visit)completed++
   if(i===route.length-1){done=true;speed=car.v=0;return}
   i++;m=0;j=1
   if(route[i].transfer){hold=1.15;speed=car.v=0}
  }
 }
 return {tick,place:car=>pose(car,0),total,get completed(){return completed},get done(){return done},
  get label(){return route[i].label},get transfer(){return hold>0},get meters(){return elapsedDistance}}
}

export function interchangeTour(city){
 const l=city.tourLanes, route=[]
 const main={東:l['civic-1'],西:l.civic1.slice().reverse(),新北:['51362361','260152357'].flatMap(k=>l[k]),新南:['50289495','1079151555','244450513'].flatMap(k=>l[k]),建北:['910567292','910567291'].flatMap(k=>l[k]),建南:['910959595','252657373','252657374'].flatMap(k=>l[k])}
 const drives=[
 ['市民高架｜新生南路入口','西',1,'-51362368 -51362403 51362366'],
 ['市民高架｜新生南路出口','東',0,'51362367 51362403 51362368'],
 ['新生高架｜八德路北向入口','新北',1,'51362398 1132433053'],
 ['新生高架｜長安東路北向出口','新北',0,'1132431808 51289047'],
 ['新生高架｜長安東路南向入口','新南',1,'51362434 1132431141'],
 ['新生高架｜八德路南向出口','新南',0,'1132433052 51362381'],
 ['市民高架｜建國南路入口','東',1,'49073264 593852344 49073265 49073263'],
 ['市民高架｜建國南路出口','西',0,'49073277 -49073265 -593852344 593852343'],
 ['建國高架｜忠孝東路北向入口','建北',1,'49073297'],
 ['建國高架｜長安東路北向出口','建北',0,'49710833'],
 ['建國高架｜長安東路南向入口','建南',1,'49710834'],
 ['建國高架｜忠孝東路南向出口','建南',0,'48794890']]
 const dist=distance
 for(const [label,key,entry,ids] of drives){
  const parts=ids.split(' ').map(raw=>{
   const id=raw.replace('-','')
   let p=l[id]
   if(raw.startsWith('-')){
    p=p.slice().reverse().map((v,i,points)=>{
     const next=points[Math.min(points.length-1,i+1)],prev=points[Math.max(0,i-1)]
     const angle=Math.atan2(next[1]-prev[1],next[0]-prev[0])
     return [v[0]+3.4*Math.sin(angle),v[1]-3.4*Math.cos(angle),v[2]]
    })
   }
   return {id,p,kind:'ramp'}
  })
  const target=entry?parts.at(-1).p.at(-1):parts[0].p[0],through=main[key],idx=through.reduce((best,p,i)=>dist(p,target)<dist(through[best],target)?i:best,0)
  let end=idx;while(through[end+(entry?1:-1)]&&dist(through[end],target)<155)end+=entry?1:-1
  const mainLeg={id:({東:'civic-1',西:'civic1',新北:'51362361',新南:'244450513',建北:'910567291',建南:'252657373'})[key],kind:key.length===1?'main':'cross',p:through.slice(Math.min(idx,end),Math.max(idx,end)+1)}
  if(entry)parts.push(mainLeg);else parts.unshift(mainLeg)
  // Use the centre of the narrower branch as the common endpoint.
  // Carry the lane change on the wider carriageway on either side.
  for(const part of parts)part.p=part.p.map(v=>v.slice())
  const width=part=>city.transport.roads.find(r=>r.id===part.id).w
  for(let i=1;i<parts.length;i++){
   const prev=parts[i-1],next=parts[i],end=prev.p.at(-1),start=next.p[0]
   const joint=width(prev)<=width(next)?end:start
   for(const [part,anchor] of [[prev,end],[next,start]]){
    const delta=joint.map((v,k)=>v-anchor[k])
    part.p=part.p.map(v=>{const t=Math.min(1,dist(v,anchor)/30);return v.map((w,k)=>w+delta[k]*(1-t*t*(3-2*t)))})
   }
  }
  for(const [i,part] of parts.entries()){
   const leg=segment({...part,label},part.p)
   route.push({...leg,visit:true,transfer:i===0&&route.length>0})
  }
 }
 return route
}
