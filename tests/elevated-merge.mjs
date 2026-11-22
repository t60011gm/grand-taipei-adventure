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
