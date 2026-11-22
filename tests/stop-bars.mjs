import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTraffic,point} from '../traffic.js'
import {detector,phase,stopBarWidth} from '../crossings.js'
import {types} from '../fleet.js'

const city={tourLanes:JSON.parse(readFileSync(new URL('../assets/tour-lanes.json',import.meta.url)))}
const network=createTraffic(city),away={x:-99999,n:-99999,h:0}
const events=detector(network.walks),sites=new Set()
let approaches=0,runs=0,min=Infinity
for(const lane of new Set(network.cars.map(c=>c.lane))){
 for(const e of events(lane).filter(e=>!e.c)){
  const bar=point(lane,e.m),j=e.j
  assert(network.stopBars.some(b=>b.j===j&&Math.hypot(b.x-bar.x,b.n-bar.n)<1))
  sites.add(j);approaches++
  for(const type of [0,1,2,3,4,5]){
   const flow=createTraffic({tourLanes:{}}),{length,width}=types[type]
   // Start within the first second of this approach's red, using the game's own clock.
   let green=phase(0,j.id,e.ns)==='green'
   while(!green||phase(flow.time,j.id,e.ns)!=='red'){
    flow.tick(.1,away);green||=phase(flow.time,j.id,e.ns)==='green'
   }
   const m=Math.max(0,e.m-length/2-13)
   const car={...point(lane,m),lane,m,previous:m,type,stations:[],index:0,length,v:3,cruise:8,state:'drive'}
   flow.cars.push(car)
   for(let i=0;i<130;i++){
    flow.tick(.1,away)
    const dx=bar.x-car.x,dn=bar.n-car.n,angle=car.angle-bar.angle
    const extent=(length*Math.abs(Math.cos(angle))+width*Math.abs(Math.sin(angle)))/2
    const gap=dx*Math.cos(bar.angle)+dn*Math.sin(bar.angle)-extent-stopBarWidth/2
    assert(gap>=0,`${j.name} ${types[type].name} crossed bar by ${-gap}m`)
    min=Math.min(min,gap)
   }
   assert(car.v<.05,`${j.name} ${types[type].name} still moving`)
   runs++
  }
 }
}
assert.equal(sites.size,23)
console.log({sites:sites.size,approaches,runs,minFrontCornerClearance:min})
