import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTraffic,phase} from '../traffic.js'
import {types} from '../fleet.js'

const lanes=JSON.parse(readFileSync(new URL('../assets/tour-lanes.json',import.meta.url)))
const flow=createTraffic({tourLanes:lanes})
const lead=flow.cars.find(c=>c.lane.through&&c.m<c.lane.entry&&c.lane.entry-c.m<20)
const {entry,through,exitWalk}=lead.lane
const followers=flow.cars.filter(c=>c.lane===through&&c.m<lead.m).sort((a,b)=>b.m-a.m).slice(0,2)
const queue=[lead,...followers]
assert.deepEqual(queue.map(c=>types[c.type].name),['sedan','scooter','bus'])
function separated(a,b){
 // Separating axes of the two oriented body rectangles, including through the turn.
 for(const angle of [a.angle,b.angle,a.angle+Math.PI/2,b.angle+Math.PI/2]){
  const half=c=>(c.length*Math.abs(Math.cos(c.angle-angle))+types[c.type].width*Math.abs(Math.sin(c.angle-angle)))/2
  if(Math.abs((a.x-b.x)*Math.cos(angle)+(a.n-b.n)*Math.sin(angle))>half(a)+half(b))return true
 }
 return false
}
let red=false,yielded=0,crossed=false
for(let i=0;i<45*90;i++){
 flow.tick(1/90,{x:-9999,n:-9999,h:0})
 const color=phase(flow.time,exitWalk.j.id,false)
 if(color==='red'&&queue.every(c=>c.v<.15&&c.m+c.length/2<entry))red=true
 if(color==='green'&&exitWalk.active){
  assert(lead.v<.01&&lead.m+lead.length/2<entry)
  yielded++
 }
 if(yielded&&!exitWalk.active)crossed=true
 assert(separated(lead,followers[0])&&separated(lead,followers[1])&&separated(...followers))
}
assert(red&&yielded>90&&crossed)
assert(queue.every(c=>c.v>2&&c.m>entry+10))
assert(lead.angle< -1.3)
console.log('敦化東行右轉、綠燈禮讓與三車排隊通過')
