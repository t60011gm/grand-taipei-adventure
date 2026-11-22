import {assetURL} from './asset-location.js'
// Use the same service state as the animated doors, including player boarding holds.
export function createBusAudio(flow,pass){
 const buses=flow.cars.filter(c=>c.stations?.[0]?.route==='669')
 const previous=new Map(),buffers=new Map()
 let ctx,engine,motor,request
 function start(){
  if(!window.AudioContext)return
  if(!ctx){
   ctx=new AudioContext()
   motor=ctx.createGain();motor.gain.value=0;motor.connect(ctx.destination)
   const names=new Set(['engine','open','close','bell',...buses.flatMap(b=>b.stations.map(s=>s.name))])
   for(const key of names)fetch(assetURL('bus-audio/'+key+'.wav'))
    .then(r=>r.arrayBuffer()).then(data=>ctx.decodeAudioData(data)).then(buffer=>{
     buffers.set(key,buffer)
     if(key==='engine'){
      engine=ctx.createBufferSource();engine.buffer=buffer;engine.loop=true
      engine.connect(motor);engine.start()
     }
    }).catch(e=>console.warn('669 音效',key,e))
  }
  ctx.resume().catch(()=>{})
 }
 function pause(){ctx?.suspend().catch(()=>{})}
 function play(key,volume){
  const buffer=buffers.get(key)
  if(!buffer||ctx.state!=='running')return
  const source=ctx.createBufferSource(),gain=ctx.createGain()
  source.buffer=buffer;gain.gain.value=volume
  source.connect(gain);gain.connect(ctx.destination)
  source.onended=()=>{source.disconnect();gain.disconnect()};source.start()
 }
 function update(actor){
  const aboard=buses.includes(pass.bus)
  let nearest=aboard?pass.bus:null,distance=aboard?0:34
  if(flow.enabled&&!nearest)for(const bus of buses){
   if(bus.wait)continue
   const d=Math.hypot(actor.x-bus.x,actor.z+bus.n,(actor.roadHeight??bus.h)-bus.h)
   if(d<distance){distance=d;nearest=bus}
  }
  const proximity=flow.enabled&&nearest?Math.max(0,1-distance/34):0
  const volume=proximity*(aboard ? .16 : .24)
  const rate=1+Math.min(1,(nearest?.v??0)/15)*.84
  const events=[]
  for(const bus of buses){
   const door=bus.door,old=previous.get(bus)??0
   if(proximity&&nearest===bus){
    if(door>0&&old===0){
     events.push(['open',proximity*.72])
     const stop=bus.stations[bus.index]
     if(stop)events.push([stop.name,proximity*.97])
    }
    if(door<1&&old===1)events.push(['close',proximity*.72])
    if(pass.bus===bus&&pass.requested&&request!==pass.requested)events.push(['bell',.82])
   }
   previous.set(bus,door)
  }
  request=pass.requested
  if(engine){
   motor.gain.setTargetAtTime(volume,ctx.currentTime,.055)
   engine.playbackRate.setTargetAtTime(rate,ctx.currentTime,.10)
  }
  for(const [key,gain] of events)play(key,gain)
  return {volume,rate,events}
 }
 return {start,pause,update}
}
