// Survey-space crossing endpoints come from the same definitions used for the painted stripes.
import {walkOpen} from './crossings.js'
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)
export function returnWalk(game,flow,start,stop){
 const nodes=[{x:start.x,z:start.z}],clear=(x,z)=>game.valid(x,z,.3)&&flow.stops.every(s=>Math.hypot(x-s.poleX,z+s.poleN)>.34)
 function segment(a,b){
  const count=Math.ceil(distance(a,b)/.25)
  for(let i=1;i<=count;i++)if(!clear(a.x+(b.x-a.x)*i/count,a.z+(b.z-a.z)*i/count))return false
  return true
 }
 function add(p){if(!segment(nodes.at(-1),p))throw Error('步道受阻 '+p.x.toFixed(1));nodes.push(p)}
 function sidewalk(to,side){
  // Try adjacent strips of pavement around columns and street furniture.
  let current=[{p:nodes.at(-1),cost:0}],x=Math.floor(current[0].p.x)-1
  for(;x>to.x;x-=1){
   const next=[],curb=game.sample(x,side===1?2:3)
   for(const off of [1,1.55,.45,2.1,2.7,3.4,4.1,4.8,5.5]){
    const p={x,z:game.center(x)+side*(curb+off)}
    if(!clear(p.x,p.z))continue
    const options=current.map(prev=>({prev,cost:prev.cost+distance(prev.p,p)+Math.abs(off-1.55)*.04})).sort((a,b)=>a.cost-b.cost)
    const best=options.find(({prev})=>segment(prev.p,p));if(best)next.push({p,...best})
   }
   current=next
  }
  let last=current.filter(n=>segment(n.p,to)).sort((a,b)=>a.cost+distance(a.p,to)-b.cost-distance(b.p,to))[0]
  if(!last)throw Error('無可通行的人行道 '+x)
  const path=[];while(last.prev){path.push(last.p);last=last.prev}
  nodes.push(...path.reverse(),to)
 }
 const crossings=[...flow.walks.filter(c=>c.j.x===3119&&c.line>0),...flow.walks.filter(c=>[2930,2654].includes(c.j.x)&&!c.ns&&c.line>0).sort((a,b)=>b.j.x-a.j.x)]
 for(const c of crossings){
  function endpoint(p){
   // Keep westbound pedestrians on the outer half of the east-west zebra.
   const offset=c.ns?0:1
   return {x:p[0]-c.j.sin*offset,z:-p[1]-c.j.cos*offset}
  }
  const entry=endpoint(c.ns?c.a:c.b),exit=endpoint(c.ns?c.b:c.a)
  if(c===crossings[1])add(entry);else sidewalk(entry,c.ns?1:-1)
  add({...exit,cross:c})
 }
 const dest={x:stop.poleX+.9*Math.cos(stop.angle)+.65*Math.sin(stop.angle),z:-stop.poleN-.9*Math.sin(stop.angle)+.65*Math.cos(stop.angle)}
 sidewalk(dest,-1)
 let i=1,auto=false,cross=null,entered=0,waiting=false
 function step(dt,keys){
  const a=game.person
  if(keys.size&&['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k)))auto=false
  if(i>=nodes.length)return false
  const p=nodes[i],previous=nodes[i-1]
  if(p.cross&&!cross&&distance(a,previous)<2){
   waiting=!walkOpen(flow.time,p.cross)
   if(!waiting&&auto){cross=p.cross;cross.player=true;entered++}
  }
  if(distance(a,p)<(auto?.06:1.3)){
   if(cross)cross.player=false
   cross=null;waiting=false;i++
   return auto
  }
  if(!auto){
   // A player walking freely may rejoin the marked sidewalk farther along.
   if(!p.cross&&distance(a,p)>3)for(let j=i+1;j<nodes.length&&!nodes[j].cross;j++){
    if(distance(a,nodes[j])<1.5){i=j;break}
   }
   return false
  }
  if(p.cross&&!cross)return true
  const d=distance(a,p),f=Math.min(1,2.3*dt/d)
  a.yaw=Math.atan2(p.z-a.z,p.x-a.x)
  game.walkTo(a.x+(p.x-a.x)*f,a.z+(p.z-a.z)*f)
  return true
 }
 function allow(x,z){
  const p=nodes[i]
  if(!p?.cross||cross)return true
  const a=nodes[i-1],d=distance(a,p),progress=((x-a.x)*(p.x-a.x)+(z-a.z)*(p.z-a.z))/d
  if(progress<=.15||distance(game.person,a)>2)return true
  if(!walkOpen(flow.time,p.cross)){waiting=true;return false}
  cross=p.cross;cross.player=true;entered++;waiting=false;return true
 }
 return {nodes,stop,step,allow,get index(){return i},get entered(){return entered},get auto(){return auto},get waiting(){return waiting},
  toggle(){auto=!auto},clear(){if(cross)cross.player=false;auto=false;cross=null}}
}
