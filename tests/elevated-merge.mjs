import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTraffic,path,point} from '../traffic.js'

const tourLanes=JSON.parse(readFileSync(new URL('../assets/tour-lanes.json',import.meta.url)))
const traffic=createTraffic({tourLanes})
for(const id of ['新生北向','新生南向','建國北向','建國南向','光復西向匯入']){
 assert(traffic.cars.some(c=>c.lane.id===id),id)
}
const ramp=Object.assign(path(tourLanes.guangfuWest),{id:'guangfuWest'})
const end=ramp.p.at(-1),station=ramp.length-25,index=point(ramp,station).i
const through=traffic.cars.find(c=>c.lane.id==='civic1')
for(const car of traffic.cars)car.wait=true
const junction=through.lane.p.findIndex(p=>p[0]<=end[0])
through.m=through.lane.s[junction]-28
Object.assign(through,point(through.lane,through.m),{wait:false,v:20})
const check=()=>traffic.guide(ramp,station,index,11)
const conflict=check()
assert.equal(conflict.reason,'匯入前讓車')
assert(conflict.speed<11&&conflict.distance>0)
through.h-=5
assert(check().speed>11,'vertically separated through traffic should not block the ramp')
through.wait=true
assert(check().speed>11,'the ramp should resume when the through vehicle clears')
console.log('四段橫向高架車流、匝道匯入前減速、跨層分離與主線淨空後放行通過')

traffic.clearOverlap({x:-10000,n:-10000,h:0})
for(const [rampId,throughId] of [
 ['51362366','civic1'],['49073263','civic-1'],['1132433053','新生北向'],
 ['1132431141','新生南向'],['49073297','建國北向'],['49710834','建國南向']
]){
 const approach={...path(tourLanes[rampId]),id:rampId}
 const car=traffic.cars.find(c=>c.lane.id===throughId)
 const end=approach.p.at(-1)
 const distance=p=>Math.hypot(...p.map((v,i)=>v-end[i]))
 const index=car.lane.p.reduce((best,p,i)=>distance(p)<distance(car.lane.p[best])?i:best,0)
 car.m=car.lane.s[index]-35
 Object.assign(car,point(car.lane,car.m),{wait:false,v:17})
 const m=approach.length-24,guide=()=>traffic.guide(approach,m,point(approach,m).i,11)
 assert.equal(guide().reason,'匯入前讓車',rampId)
 assert(guide().speed<11,rampId)
 car.wait=true
 assert(guide().speed>11,rampId)
}
console.log('六條新生、建國入口皆會在主線來車時讓車，待空檔恢復通行')
