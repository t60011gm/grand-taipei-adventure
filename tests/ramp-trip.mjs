// Run with node tests/ramp-trip.mjs. Start in a through lane and steer onto each feeder.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createGame} from '../sim.js'

function asset(name) {
  return JSON.parse(readFileSync(new URL('../assets/'+name+'.json',import.meta.url)))
}
const city=asset('city'),west=asset('route'),transport=asset('transport')
Object.assign(city,{
  transport,routeStart:west.start,routeProfile:west.profile.concat(city.profile),
  sideStreets:west.sideStreets,alleyPassages:west.alleyPassages,
  columns:city.columns.concat(west.columns,[...transport.piers,...transport.parked].map(([x,y,r])=>[x,-y,r]))
})
function points(id,reverse=false) {
  const result=transport.roads.find(road=>road.id===id).p.slice()
  return reverse?result.reverse():result
}
function checkTrip(east,driving) {
  const g=createGame(city),dir=east?1:-1
  const feeder=east?points('ground593849724'):points('ground304148115',true)
  const x=feeder[0][0]-dir*37,z=g.center(x)+dir*12
  const route=[[x,-z],[x+dir*12,-g.center(x+dir*12)-dir*11]]
  if(!east)route.push([1116,-g.center(1116)+12])
  route.push(...feeder)
  const branches=east?[['49073264'],['593852344'],['49073265'],['49073263']]:
    [['51362368',true],['51362403',true],['51362366']]
  for(const [id,reverse] of branches)route.push(...points(id,reverse))
  const main=east?'civic-1':'civic1',junction=route.at(-1)[0]
  route.push(...points(main,!east).filter(q=>dir*(q[0]-junction)>0).slice(0,23))

  if(driving)g.interact()
  const actor=g.actor
  Object.assign(actor,{x,z,yaw:east?0:Math.PI})
  let next=1
  const reached=new Set()
  for(let frame=0;frame<42000;frame++) {
    const [px,py]=route[next],dx=px-actor.x,dz=-py-actor.z
    if(Math.hypot(dx,dz)<(driving?3:1.05)) {
      next++
      if(next===route.length)break
      continue
    }
    const angle=Math.atan2(dz,dx)-actor.yaw,error=Math.atan2(Math.sin(angle),Math.cos(angle))
    const keys=new Set()
    if(!driving||actor.v<4.5)keys.add('KeyW')
    if(!driving)keys.add('ShiftLeft')
    if(Math.abs(error)>.018)keys.add(error>0?'KeyD':'KeyA')
    g.tick(1/60,keys)
    if(actor.roadId)reached.add(actor.roadId)
  }
  assert.equal(next,route.length)
  assert.equal(actor.roadId,main)
  for(const [id] of branches)assert(reached.has(id),id)
  if(driving) {
    for(let frame=0;frame<130;frame++)g.tick(1/60,new Set(['Space']))
    g.interact()
    assert(!g.riding)
    assert.equal(g.person.roadId,main)
    assert(Math.abs(g.person.roadHeight-actor.roadHeight)<.3)
    g.interact()
    assert(g.riding)
  }
}
for(const east of [true,false])for(const driving of [true,false])checkTrip(east,driving)
console.log('通過：建國與新生平面進場、步行與駕駛上橋、橋面下車與再上車')
