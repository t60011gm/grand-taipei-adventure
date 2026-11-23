import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTraffic} from '../traffic.js'
import {createTour} from '../tour.js'

const tourLanes=JSON.parse(readFileSync(new URL('../assets/tour-lanes.json',import.meta.url)))
const traffic=createTraffic({tourLanes},true)
assert.equal(traffic.movements.length,6)
for(const move of traffic.movements){
 const tour=createTour([{...move.leg,transfer:false}]),car={}
 tour.place(car)
 traffic.stage(car.roadId)
 let slowed=false,crossed=false,minRear=Infinity
 for(let tick=0;!tour.done;tick++){
  assert(tick<90*60,move.id+' stalled')
  const previous=car.v
  traffic.tick(1/90,{x:car.x,n:-car.z,h:car.roadHeight,v:car.v,angle:-car.yaw,roadId:car.roadId})
  tour.tick(car,1/90,traffic)
  if(traffic.status==='主線減速留空間'&&car.v<previous-.001)slowed=true
  const station=move.leg.mainStart+car.roadProgress
  if(!crossed&&move.car.m>=move.mergeAt){
   assert(move.at-station>10,move.id+' insufficient space at merge')
   crossed=true
  }
  if(Math.abs(move.at-station)<55){
   assert(car.v>2,move.id+' blocked in merge')
   minRear=Math.min(minRear,station-move.follower.m-(4.38+move.follower.length)/2)
  }
 }
 assert(slowed&&crossed&&minRear>15,move.id)
}
console.log('Six through-lane passes yielded, merged and cleared with rear bumper clearance.')
