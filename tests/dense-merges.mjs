import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTraffic} from '../traffic.js'
import {createTour} from '../tour.js'
const tourLanes=JSON.parse(readFileSync(new URL('../assets/tour-lanes.json',import.meta.url)))
const flow=createTraffic({tourLanes},'dense')
for(const move of flow.movements){
 const tour=createTour([{...move.leg,transfer:false}]),car={}
 tour.place(car);flow.stage(car.roadId)
 let crossed=0
 const ordered=[move.leader,move.queue[0],null,move.queue[1],move.follower,move.queue[2],move.tail]
 for(let tick=0;!tour.done;tick++){
  assert(tick<90*65,move.id+' stalled')
  flow.tick(1/90,{x:car.x,n:-car.z,h:car.roadHeight,v:car.v,roadId:car.roadId,angle:-car.yaw,roadProgress:car.roadProgress})
  tour.tick(car,1/90,flow)
  const positions=ordered.map(v=>v===null?move.leg.mainStart+car.roadProgress-move.at:move.queue.includes(v)?v.m-move.mergeAt:v.m-move.at)
  for(let i=0;i<positions.length;i++){
   if(positions[i]<0)continue
   assert(i<=crossed,move.id+' out of turn')
   if(i===crossed)crossed++
   if(i&&positions[i]<55)assert(positions[i-1]-positions[i]>(ordered[i-1]?.length??4.38)/2+(ordered[i]?.length??4.38)/2+3,move.id+' unsafe clearance')
  }
 }
 assert.equal(crossed,7)
}
console.log('Dense merges completed in alternating order with positive bumper clearance at all six junctions.')
