// A vehicle alongside the rear door must clear before a stopped bus may pull out.
import assert from 'node:assert/strict'
import {resetService,serviceLimit,busPose} from '../bus-service.js'
import {path,point} from '../traffic.js'
const lane=path(Array.from({length:110},(_,i)=>[i,0,2]))
const station={m:50,offset:3.1,pgp:null}
for(const pgp of [null,'-1','1']){
 const bus={m:50,lane,length:10.8,stations:[{...station,pgp}]}
 resetService(bus)
 const base=point(lane,50)
 Object.assign(bus,busPose(bus,base,50))
 const alongside={x:48,n:0,h:2}
 for(let i=0;i<180;i++){
  assert.equal(serviceLimit(bus,.1,alongside,[bus]),0)
  if(bus.door>0)assert.equal(bus.indicator,0)
 }
 assert.equal(bus.state,'signal');assert.equal(bus.indicator,-1);assert.equal(bus.door,0)
 assert.equal(bus.boarded,pgp==='-1'?0:1);assert.equal(bus.alighted,pgp==='1'?0:1)
 assert.equal(serviceLimit(bus,.1,{x:30,n:0,h:2},[bus]),Infinity)
 assert.equal(bus.state,'depart')
 assert.equal(busPose(bus,point(lane,74),74).n,0)
 bus.m=74;serviceLimit(bus,.1,alongside,[bus]);assert.equal(bus.indicator,0)
}
console.log('並行車阻擋匯入、車尾淨空後起步、分向上下客與關門方向燈測試通過')

// Replay a real eastbound 669 stop with a guided car behind the bus.
const {readFileSync}=await import('node:fs')
const {createTraffic}=await import('../traffic.js'),{createTour}=await import('../tour.js')
const lanes=JSON.parse(readFileSync(new URL('../assets/tour-lanes.json',import.meta.url)))
const id='tourSurface-1',flow=createTraffic({tourLanes:{[id]:lanes[id]}})
const lead=flow.cars.find(c=>c.type===4),stop=lead.stations[0]
flow.cars.splice(0,flow.cars.length,lead)
lead.m=lead.previous=stop.m-65;Object.assign(lead,point(lead.lane,lead.m));resetService(lead)
const start=point(lead.lane,lead.m-25).i
const route={...path(lead.lane.p.slice(start,point(lead.lane,stop.m+90).i)),kind:'surface',visit:true,id}
const tour=createTour([route]),car={}
tour.place(car)
let minimum=Infinity,slowed=false,resumed=false,merged=false,initialSpeed=0
for(let i=0;i<12000&&!tour.done;i++){
 flow.tick(1/90,{x:car.x,n:-car.z,h:car.roadHeight})
 tour.tick(car,1/90,flow)
 const separation=lead.m-(lead.lane.s[start]+tour.meters)-(lead.length+4.38)/2
 minimum=Math.min(minimum,separation)
 if(lead.state==='dwell'||lead.state==='signal'){
  if(car.v<initialSpeed-.5&&flow.status==='禮讓停靠公車')slowed=true
 }else if(lead.state==='depart')merged=true
 else if(merged&&car.v>2)resumed=true
 if(!merged)initialSpeed=Math.max(initialSpeed,car.v)
}
assert(tour.done&&slowed&&merged&&resumed&&minimum>=3)
console.log(stop.name,'靠站跟車、減速、匯入後續行，沿車道最小車身淨距',minimum.toFixed(2),'m')
