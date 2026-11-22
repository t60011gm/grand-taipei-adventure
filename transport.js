// Heights are absolute game metres. Keep stacked decks distinct at the same map position.
export function indexTransport(data){
 const buckets=new Map(),roads=new Map()
 const key=(x,z)=>Math.floor(x/32)+','+Math.floor(z/32)
 for(const road of data?.roads??[]){
  roads.set(road.id,road)
  let distance=0
  for(let i=1;i<road.p.length;i++){
   const [x,north,h]=road.p[i-1],[x1,north1,h1]=road.p[i],z=-north,z1=-north1
   const dx=x1-x,dz=z1-z,len=Math.hypot(dx,dz)
   if(len<.001)continue
   const w0=road.widths?.[i-1]??road.w,w1=road.widths?.[i]??road.w
   const half=Math.max(w0,w1)/2,seg={road,x,z,h,dx,dz,dh:h1-h,len,dist:distance,w0,w1}
   for(let bx=Math.floor((Math.min(x,x1)-half-2)/32);bx<=Math.floor((Math.max(x,x1)+half+2)/32);bx++){
    for(let bz=Math.floor((Math.min(z,z1)-half-2)/32);bz<=Math.floor((Math.max(z,z1)+half+2)/32);bz++){
     const id=bx+','+bz;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(seg)
    }
   }
   distance+=len
  }
  road.length=distance
 }
 function nearby(x,z,radius){
  const closest=new Map()
  for(const s of buckets.get(key(x,z))??[]){
   const px=x-s.x,pz=z-s.z,t=(px*s.dx+pz*s.dz)/(s.len*s.len)
   if(s.road.kind!=='footway' && (t*s.len < -.25 || (t-1)*s.len > .25))continue
   const u=Math.max(0,Math.min(1,t))
   const dist=Math.hypot(px-u*s.dx,pz-u*s.dz)
   if(dist+radius>(s.w0+(s.w1-s.w0)*u)/2)continue
   const along=s.dist+u*s.len
   if(dist >= (closest.get(s.road)?.distance??Infinity))continue
   closest.set(s.road,{road:s.road,height:s.h+u*s.dh,progress:along,distance:dist,dx:s.dx/s.len,dz:s.dz/s.len,slope:s.dh/s.len})
  }
  return [...closest.values()]
 }
 const isGround=r=>r.kind==='surface'||r.kind==='lot'
 function street(x,z,radius,walking=false){
  return nearby(x,z,radius).some(({road,progress})=>isGround(road) || (walking && road.kind==='footway') ||
   (road.kind==='ramp' && ((road.ground[0] && progress<=3) || (road.ground[1] && road.length-progress<=3))))
 }
 function move(actor,x,z,yaw,radius,ground,walking=false){
  const candidates=nearby(x,z,radius)
  const current=roads.get(actor.roadId),oldHeight=actor.roadHeight??ground
  let best=null,bestScore=Infinity
  for(const p of candidates){
   const rd=p.road
   if(isGround(rd)||rd.kind==='footway')continue
   const garage=rd.kind==='parking'||rd.kind==='fork'
   const align=Math.abs(p.dx*Math.cos(yaw)+p.dz*Math.sin(yaw))
   const mouth=rd.ground[0]&&p.progress<9 || rd.ground[1]&&rd.length-p.progress<9
   const dy=Math.abs(oldHeight-p.height)
   if(!current && (!mouth || dy>.52 || (!walking && align<(garage?.985:.42))))continue
   if(current && current!==rd && dy>.37)continue
   if(rd.kind==='parking' && p.progress>rd.length-(walking?.55:2.40))continue
   // At branches the steering direction and the distance to the centreline select a carriageway.
   const score=dy*1.1+(1-align)*3+p.distance/rd.w+(rd===current?-.18:0)
   if(score<bestScore){best=p;bestScore=score}
  }
  if(best)return {roadId:best.road.id,roadHeight:best.height,roadProgress:best.progress,roadSlope:best.slope*(best.dx*Math.cos(yaw)+best.dz*Math.sin(yaw))}
  if(current){
   const nearExit=current.ground[0]&&actor.roadProgress<12 || current.ground[1]&&current.length-actor.roadProgress<12
   if(!nearExit||Math.abs(oldHeight-ground)>.53)return false
  }
  // A sunken driveway has retaining walls. Access starts at its surface throat.
  if(candidates.some(p=>p.road.kind==='parking'&&ground-p.height>.40))return false
  return {roadId:null,roadHeight:null,roadProgress:0,roadSlope:0}
 }
 return {street,move,roads}
}
