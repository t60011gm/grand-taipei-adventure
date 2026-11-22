import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTour,planTour} from '../tour.js'
import {createTraffic} from '../traffic.js'
const read=s=>JSON.parse(readFileSync(new URL('../assets/'+s+'.json',import.meta.url)))
const city={tourLanes:read('tour-lanes'),transport:read('transport')}
const tour=createTour(planTour(city)),flow=createTraffic(city),car={}
tour.place(car)
const served=new Set(),merged=new Set()
let busYield=0,minBusGap=Infinity,encounters=0
let guideQueue=Infinity,guideSamples=0
let still=0,minQueue=Infinity,red=0,yielded=0,peak=0,queueSamples=0
const groups=Map.groupBy(flow.cars,c=>c.lane)
for(let i=0;!tour.done;i++){
 const player={x:car.x,n:-car.z,h:car.roadHeight}
 flow.tick(.1,player)
 for(const bus of flow.cars){
  if(bus.type!==4||bus.wait)continue
  const stop=bus.stations[bus.index]
  if(bus.state==='dwell'){assert(bus.v<.001);served.add(stop.id)}
  if(bus.state==='depart'){assert.equal(bus.door,0);merged.add(stop.id)}
 }
 const before=tour.meters,transfer=tour.transfer
 tour.tick(car,.1,flow)
 if(transfer&&!tour.transfer)flow.clearOverlap({x:car.x,n:-car.z,h:car.roadHeight})
 still=tour.meters-before<.001?still+1:0
 assert(still<1200,'停滯 '+tour.label+' '+JSON.stringify(car)+' '+flow.status)
 assert(i<120000)
 if(car.v<.15&&flow.status==='等候號誌')red++
 if(car.v<.15&&flow.status==='停讓行人')yielded++
 if(flow.status==='禮讓停靠公車'&&!tour.transfer){
  busYield++
  for(const bus of flow.cars){
   if(bus.type!==4||bus.wait||bus.state==='drive'||Math.abs(bus.h-car.roadHeight)>1)continue
   const dx=bus.x-car.x,dn=bus.n+car.z,u=Math.cos(car.yaw),v=-Math.sin(car.yaw),front=dx*u+dn*v
   if(front<=0||front>50||Math.abs(dx*v-dn*u)>2.1||Math.cos(bus.angle+car.yaw)<.96)continue
   minBusGap=Math.min(minBusGap,front-(bus.length+4.38)/2);encounters++
  }
 }
 peak=Math.max(peak,car.v*3.6)
 if(!tour.transfer&&!transfer&&Math.abs(car.v)<.6&&i%5===0){
  const ux=Math.cos(car.yaw),un=-Math.sin(car.yaw)
  for(const c of flow.cars){
   if(c.wait||c.v>.6||Math.abs(c.h-car.roadHeight)>1||Math.cos(c.angle+car.yaw)<.985)continue
   const dx=c.x-car.x,dn=c.n+car.z,along=dx*ux+dn*un
   if(along<=0||along>25||Math.abs(dx*un-dn*ux)>1.4)continue
   guideQueue=Math.min(guideQueue,along-(4.38+c.length)/2);guideSamples++
  }
 }
 if(i%10===0)for(const vehicles of groups.values()){
  const sorted=vehicles.filter(c=>!c.wait).sort((a,b)=>a.m-b.m)
  for(let j=1;j<sorted.length;j++){
   const a=sorted[j-1],b=sorted[j]
   if(a.v>.6||b.v>.6)continue
   const gap=b.m-a.m-(a.length+b.length)/2
   if(gap<20){minQueue=Math.min(minQueue,gap);queueSamples++}
  }
 }
}
assert.equal(served.size,flow.stops.length);assert.equal(merged.size,served.size)
assert(encounters>0&&minBusGap>0&&busYield>0)
assert(guideQueue>0&&guideSamples)
assert(minQueue>=2.99&&queueSamples&&yielded&&red&&peak>=75)
console.log({stopsServed:served.size,minBusGap,busYieldSeconds:busYield/10,encounters,legs:tour.completed,km:tour.meters/1000,minutes:flow.time/60,peak,minQueue,queueSamples,guideQueue,guideSamples,redSeconds:red/10,yieldSeconds:yielded/10})
