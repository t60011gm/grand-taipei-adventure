// Replay the delivered planner and check the swept body against the game's obstacles.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {planTour,createTour} from '../tour.js'
const read=name=>JSON.parse(readFileSync(new URL('../assets/'+name+'.json',import.meta.url)))
const city=read('city'),west=read('route'),transport=read('transport'),profile=[...west.profile,...city.profile]
const ground=x=>profile[Math.max(0,Math.min(profile.length-1,Math.round(x-west.start)))][1]
const supports=readFileSync(new URL('../墩頂與梁底接合檢查.csv',import.meta.url),'utf8').trim().split(/\r?\n/).slice(1).map(row=>row.split(',').slice(1,5).map(Number))
const bins=new Map(),key=(x,y)=>Math.floor(x/8)+','+Math.floor(y/8)
function store(o,radius){
 for(let i=Math.floor((o.x-radius-3)/8);i<=Math.floor((o.x+radius+3)/8);i++)
 for(let j=Math.floor((o.y-radius-3)/8);j<=Math.floor((o.y+radius+3)/8);j++){
  const k=i+','+j;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o)
 }
}
for(const [x,y,r] of transport.piers){
 const s=supports.find(p=>Math.hypot(p[0]-x,p[1]-y)<.07)
 store({x,y,r,type:'pier',lo:ground(x)-.72,hi:s?s[3]-1.45:ground(x)+3.2},r)
}
for(const [x,y,r] of [...transport.parked,...[...west.columns,...city.columns].map(([x,z,r])=>[x,-z,r])])
 store({x,y,r,type:'column/parked',lo:ground(x)-.05,hi:ground(x)+2.6},r)
for(const [x,y,nx,ny,w,l] of transport.solids)
 store({x,y,nx,ny,w,l,type:'solid',lo:ground(x)-.1,hi:ground(x)+2.7},Math.hypot(w,l))
const route=planTour({transport,tourLanes:read('tour-lanes')}),tour=createTour(route),car={}
tour.place(car)
const hits=new Map()
let min=Infinity,nearest=null
for(let tick=0;!tour.done;tick++){
 assert(tick<1000000)
 tour.tick(car,1/90)
 const x=car.x,y=-car.z,z=car.roadHeight,u=Math.cos(car.yaw),v=-Math.sin(car.yaw)
 for(const o of bins.get(key(x,y))??[]){
  if(z>=o.hi||z+1.25<=o.lo)continue
  const dx=x-o.x,dy=y-o.y,a=Math.abs(dx*u+dy*v),b=Math.abs(dy*u-dx*v)
  let gap
  if(o.r!==undefined){
   gap=Math.hypot(Math.max(0,a-2.19),Math.max(0,b-1.091))-o.r
   if(o.type==='pier'&&gap<min){min=gap;nearest={road:car.roadId,x:o.x,y:o.y}}
  }else{
   const d=Math.abs(u*o.nx+v*o.ny),p=Math.abs(v*o.nx-u*o.ny)
   gap=Math.max(a-2.19-o.w*d-o.l*p,b-1.091-o.w*p-o.l*d,Math.abs(dx*o.nx+dy*o.ny)-o.w-2.19*d-1.091*p,Math.abs(dy*o.nx-dx*o.ny)-o.l-2.19*p-1.091*d)
  }
  if(gap<=.01)hits.set(car.roadId+'/'+o.type,[x,y,z,gap].map(v=>+v.toFixed(2)))
 }
}
console.log('最近橋墩淨距',min.toFixed(2),'m',nearest,Object.fromEntries(hits))
assert.equal(hits.size,0)
assert(min>.2)
