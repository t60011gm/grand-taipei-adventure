import {corridor} from './junctions.js'
export const axis=n=>3820.1+.0205*(n-330)
const sites=[320,493,658].map(n=>['光復南路',axis(n),n,2.337,0,14])
export const intersections=[...sites,...corridor].map(([name,x,n,h,angle,width],id)=>({
 name,x,n,h,angle,id,width,half:id===0?17:id<3?15:Math.round(Math.max(8,Math.min(17,width*.68))),
 cos:Math.cos(angle),sin:Math.sin(angle)
}))
export function world(j,u,v){
 return [j.x+j.cos*u-j.sin*v,j.n+j.sin*u+j.cos*v,j.h]
}
function local(j,p){
 const x=p[0]-j.x,n=p[1]-j.n
 return [x*j.cos+n*j.sin,n*j.cos-x*j.sin]
}
function timing(t,id,ns){
 const half=id<3?30:48
 return {half,offset:(t+id*13+(ns?0:half))%(2*half)}
}
export function phase(t,id,ns){
 const {half,offset}=timing(t,id,ns)
 return offset<half-6?'green':offset<half-2?'amber':'red'
}
export function walkOpen(t,c){
 const {half,offset}=timing(t,c.j.id,c.ns)
 return offset<Math.max(1,half-2-c.length/c.speed)
}
export function crossings(){
 return intersections.flatMap(j=>[true,false].flatMap(ns=>[-1,1].map(side=>{
  const reach=ns?j.width+1:j.half+1
  const line=side*(ns?j.half-3:j.width-2)
  const coords=v=>ns?world(j,line,v):world(j,v,line)
  return {j,ns,line,reach,a:coords(-reach),b:coords(reach),length:2*reach,speed:1.55,at:0,dir:1,active:false,cycle:-1}
 })))
}
// Keep the bar upstream of both the transverse zebra and the ends of the longitudinal one.
export const stopBarWidth=.4
function stopOffset(j,ns){return (ns?j.width:j.half)+6}
export function detector(crosswalks){
 const cache=new WeakMap()
 return function events(lane){
  if(cache.has(lane))return cache.get(lane)
  const out=[]
  for(let k=1;k<lane.p.length;k++){
   const a=lane.p[k-1],b=lane.p[k]
   for(const j of intersections){
    if(Math.abs(a[0]-j.x)>58||Math.abs(a[1]-j.n)>58||Math.abs(a[2]-j.h)>2.1)continue
    const l=local(j,a),r=local(j,b)
    function intersect(i,line,span){
     const d=r[i]-l[i]
     if(!d)return null
     const f=(line-l[i])/d
     if(f<=0||f>1||Math.abs(l[1-i]+f*(r[1-i]-l[1-i]))>span)return null
     return lane.s[k-1]+f*(lane.s[k]-lane.s[k-1])
    }
    const ns=Math.abs(r[1]-l[1])>Math.abs(r[0]-l[0]),i=Number(ns),dir=Math.sign(r[i]-l[i])
    const stop=intersect(i,-dir*stopOffset(j,ns),ns?j.half+4:j.width+4)
    if(stop!==null)out.push({m:stop,j,ns})
    for(const c of crosswalks.slice(j.id*4,j.id*4+4)){
     const m=intersect(c.ns?0:1,c.line,c.reach)
     if(m!==null)out.push({m,j,ns,c})
    }
   }
  }
  out.sort((a,b)=>a.m-b.m);cache.set(lane,out);return out
 }
}
