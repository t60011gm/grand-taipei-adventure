import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {planTour,createTour} from '../tour.js'
const asset=name=>JSON.parse(readFileSync(new URL('../assets/'+name+'.json',import.meta.url)))
const west=asset('route'),city=asset('city'),transport=asset('transport')
const route=planTour({tourLanes:asset('tour-lanes'),transport,routeStart:west.start,routeProfile:west.profile.concat(city.profile)})
const visits=route.filter(l=>l.visit),ids=visits.map(l=>l.id)
assert.deepEqual(new Set(ids),new Set([...transport.roads.filter(r=>r.kind!=='footway').map(r=>r.id),'tourSurface1','tourSurface-1']))
assert.equal(new Set(ids).size,ids.length)
for(const [i,id] of ['civic-1','civic1'].entries()){
 const p=transport.roads.find(r=>r.id===id).p
 assert.equal(ids[i],id)
 const ends=i?[p.at(-1),p[0]]:[p[0],p.at(-1)]
 for(const [j,q] of [visits[i].p[0],visits[i].p.at(-1)].entries())assert(Math.hypot(q[0]-ends[j][0],q[1]-ends[j][1])<5)
 assert(visits[i].length>4000)
}
for(let i=1;i<route.length;i++)if(!route[i].transfer)assert(Math.hypot(...route[i].p[0].map((v,k)=>v-route[i-1].p.at(-1)[k]))<.002)
const tour=createTour(route),car={}
tour.place(car)
let ticks=0
while(!tour.done&&ticks++<3600*3*30){
 tour.tick(car,1/30)
 assert(Number.isFinite(car.x+car.z+car.yaw+car.roadHeight+car.v))
}
assert(tour.done)
assert.equal(tour.completed,ids.length)
assert.equal(car.v,0)
console.log(tour.total+' 段，'+(tour.meters/1000).toFixed(2)+' km，'+Math.round(ticks/30/60)+' 分鐘，'+route.filter(l=>l.transfer).length+' 次換段')
