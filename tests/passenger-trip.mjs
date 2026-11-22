import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createGame} from '../sim.js'
import {createTraffic} from '../traffic.js'
import {passengerService} from '../passenger.js'

const asset=n=>JSON.parse(readFileSync(new URL('../assets/'+n+'.json',import.meta.url)))
const city=asset('city'),west=asset('route')
city.routeStart=west.start;city.routeProfile=west.profile.concat(city.profile)
city.transport=asset('transport');city.tourLanes=asset('tour-lanes')
city.columns.push(...west.columns,...[...city.transport.piers,...city.transport.parked].map(([x,n,r])=>[x,-n,r]))
const flow=createTraffic(city),game=createGame(city),pass=passengerService(flow,game)
const start=flow.stops.find(s=>s.name==='華山公園(市民)'&&s.destination==='市政府')
Object.assign(game.person,{x:start.poleX+.9*Math.cos(start.angle)+.6*Math.sin(start.angle),z:-start.poleN-.9*Math.sin(start.angle)+.6*Math.cos(start.angle)})
assert.equal(pass.nearby(),start);assert(pass.arrivals(start).seconds>0)
pass.action()
let entered=false,exited=false,sillIn=0,sillOut=0
for(let tick=0;tick<120000&&!exited;tick++){
 flow.tick(1/90,{x:game.car.x,n:-game.car.z,h:game.sample(game.car.x,1)})
 pass.tick(1/90)
 if(pass.phase==='board'||pass.phase==='exit'){
  const b=pass.bus,g=game.person,dx=g.x-b.x,dn=-g.z-b.n
  const f=dx*Math.cos(b.angle)+dn*Math.sin(b.angle),r=dx*Math.sin(b.angle)-dn*Math.cos(b.angle)
  assert(b.door>=.99&&b.v===0)
  if(r>1.1&&r<1.4){
   if(pass.phase==='board'){assert(Math.abs(f-3.78)<.01);sillIn++}
   else{assert(Math.abs(f+.648)<.01);sillOut++}
  }
 }
 if(!entered&&pass.phase==='ride'){
  entered=true;pass.bell(pass.bus.stations.find(s=>s.name==='市民敦化路口'))
 }
 exited=entered&&!pass.bus
}
assert(exited&&sillIn&&sillOut);assert.match(pass.recent,/市民敦化/)
assert(!pass.canBoard(flow.stops.find(s=>s.name==='市民敦化路口')))
const {x,z}=game.person
assert(game.valid(x,z,.35))
for(let i=0;i<90;i++)game.tick(1/90,new Set(['KeyW']))
assert(Math.hypot(game.person.x-x,game.person.z-z)>1.5)
console.log('669 華山到敦化通過：前門上車、中門下車、全程開門靜止通過門檻、落地後可步行')

const {returnWalk}=await import('../return-walk.js'),{walkOpen}=await import('../crossings.js')
const transfer=returnWalk(game,flow,game.person,flow.stops.find(s=>s.id===35459))
for(const s of flow.stops.filter(s=>s.name==='市民敦化路口'))assert(!pass.canBoard(s))
pass.action();assert.equal(pass.queued,null)
transfer.toggle()
let waits=0,last=0,delay=0
const keys=new Set(),car={x:game.car.x,n:-game.car.z,h:game.sample(game.car.x,1)}
city.walkBlocked=(x,z,h)=>!transfer.allow(x,z)||flow.cars.some(c=>{
 const dx=x-c.x,dn=-z-c.n,cs=Math.cos(c.angle),sn=Math.sin(c.angle)
 return !c.wait&&Math.abs(c.h-h)<1.8&&Math.abs(dx*cs+dn*sn)<c.length/2+.24&&Math.abs(dx*sn-dn*cs)<(c.type===4?1.24:1)+.24
})
for(let t=0;transfer.index<transfer.nodes.length;t++){
 assert(t<100000)
 flow.tick(.02,car);const i=transfer.index
 transfer.step(.02,keys)
 if(transfer.waiting)waits++
 if(transfer.entered!==last){assert(walkOpen(flow.time,transfer.nodes[i].cross));last=transfer.entered}
 delay=transfer.index===i?delay+1:0
 assert(delay<9000,'步行受阻 '+i+' '+JSON.stringify(game.person))
}
assert.equal(last,4);assert(waits>0);assert.equal(pass.nearby(),transfer.stop)
pass.action();let rang=false
for(let t=0;t<120000;t++){
 flow.tick(.02,car);pass.tick(.02)
 if(pass.phase==='ride'&&!rang&&pass.next()?.name==='華山公園(市民)'){pass.bell();rang=true}
 if(rang&&!pass.bus)break
}
assert(rang);assert.equal(pass.lastExit.id,35466);assert(!pass.bus)
const landed={...game.person}
for(let t=0;t<100;t++)game.tick(.01,new Set(['KeyW']))
assert(Math.hypot(game.person.x-landed.x,game.person.z-landed.z)>1.5)
console.log('敦化到微風廣場四處行穿線均於綠燈進入，搭回程 669、按鈴、華山下車後步行通過')
