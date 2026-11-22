import assert from 'node:assert/strict'
import {createTraffic,path,phase} from '../traffic.js'
import {createTour} from '../tour.js'
const points=Array.from({length:180},(_,x)=>[x,0,10])
const traffic=createTraffic({tourLanes:{'civic-1':points}})
const lead=traffic.cars[0],lane={...path(points),kind:'main',id:'test',visit:true}
const tour=createTour([lane]),car={}
tour.place(car)
lead.cruise=0
for(let i=0;i<1800;i++){
 traffic.tick(1/90,{x:car.x,n:-car.z,h:car.roadHeight});tour.tick(car,1/90,traffic)
 assert(lead.m-car.roadProgress>=7.379)
}
assert(car.v<.05)
lead.cruise=9
for(let i=0;i<1800;i++){
 traffic.tick(1/90,{x:car.x,n:-car.z,h:car.roadHeight});tour.tick(car,1/90,traffic)
}
assert(car.roadProgress>100)
traffic.setEnabled(false)
const time=traffic.time
traffic.tick(1,{})
assert.equal(traffic.time,time)
const signal=createTraffic({tourLanes:{}})
const makeLane=h=>({...path(Array.from({length:90},(_,i)=>[3827,610+i,h])),kind:'surface',visit:true})
const north=makeLane(2.337),upper=makeLane(10)
assert.equal(signal.guide(upper,20,21,8).speed,Infinity)
for(let i=0;i<60;i++)signal.tick(.1,{})
assert.equal(phase(signal.time,2,true),'red')
const drive=createTour([north])
drive.place(car)
for(let i=0;i<1800;i++){
 signal.tick(1/90,{});drive.tick(car,1/90,signal)
 assert(car.roadProgress<=30.801)
}
assert(car.v<.001)
for(let i=0;i<2700;i++){signal.tick(1/90,{});drive.tick(car,1/90,signal)}
assert(drive.done)
console.log('跟車停等與起步、3 公尺淨距、關閉模擬、紅燈停車、綠燈通行與跨層分離通過')

// A green eastbound approach turns south across a parallel pedestrian green.
const {intersections,world,walkOpen}=await import('../crossings.js')
const j=intersections.find(site=>site.name.includes('敦化')),turnFlow=createTraffic({tourLanes:{}})
const crossing=turnFlow.walks.find(c=>c.j===j&&!c.ns&&c.line<0)
const away={x:0,n:0,h:20}
for(let i=0;i<1000&&!crossing.active;i++)turnFlow.tick(.1,away)
assert(crossing.active&&walkOpen(turnFlow.time,crossing))
const road={...path([world(j,-7,0),world(j,-3,0),world(j,0,-2),world(j,1,-6),world(j,1,-25)]),kind:'surface',id:'turn',visit:true}
const turning=createTour([road]),driver={}
turning.place(driver)
let stopped=false
for(let i=0;i<1200&&!turning.done;i++){
 const occupied=crossing.active
 turning.tick(driver,.05,turnFlow)
 if(occupied){
  const v=(driver.x-j.x)*-j.sin+(-driver.z-j.n)*j.cos
  assert(v>crossing.line+3.9)
  if(driver.v<.001&&turnFlow.status==='停讓行人')stopped=true
 }
 turnFlow.tick(.05,{x:driver.x,n:-driver.z,h:driver.roadHeight})
}
assert(stopped&&turning.done)
console.log('敦化綠燈轉彎停讓、行人清空後通過')
