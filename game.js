import {assetURL,geometryBytes} from './asset-location.js'
import {intersections} from './crossings.js'
import {createBusAudio} from './bus-audio.js'
import {returnWalk} from './return-walk.js'
import {passengerService} from './passenger.js'
import {mainlineMovements} from './mainline.js'
import {createTraffic} from './traffic.js?v=mainline'
import {installTraffic} from './traffic-scene.js'
import {planTour,createTour,interchangeTour} from './tour.js?v=mainline'
import {createMinimap} from './minimap.js'
import * as T from './vendor/three.js'
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js'
import {installStreetFurniture} from './streetscape.js'
import {loadCitizen} from './citizen.js?v=traffic1'
import {loadVehicle} from './vehicle.js?v=traffic1'
import {createGame,clamp} from './sim.js'
const $=id=>document.getElementById(id),menu=$('menu'),start=$('start')
menu.showModal()
async function run(){
 const canvas=$('world'),renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(61,1,.09,390)
 scene.background=new T.Color(0xb9d8e4);scene.fog=new T.FogExp2(0xc6d7d8,.0053)
 scene.add(new T.HemisphereLight(0xf1f5ff,0xc7c9c8,1.82))
 const sun=new T.DirectionalLight(0xfff8eb,1.85);sun.position.set(-70,130,45);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:44,bottom:-44,near:1,far:175});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00016;sun.shadow.normalBias=.035
 const response=await fetch(assetURL('city.json'));if(!response.ok)throw Error('街區索引無法讀取')
 const city=await response.json()
 const westResponse=await fetch(assetURL('route.json'))
 if(!westResponse.ok)throw Error('華山至八德街區索引無法讀取')
 const west=await westResponse.json(),westernCount=west.chunks.length
 city.sideStreets=west.sideStreets
 city.alleyPassages=west.alleyPassages
 city.routeStart=west.start
 city.routeProfile=west.profile.concat(city.profile)
 city.chunks=west.chunks.concat(city.chunks)
 city.mats.push(...west.mats)
 city.columns.push(...west.columns)
 const trafficResponse=await fetch(assetURL('transport.json'))
 if(!trafficResponse.ok)throw Error('高架道路與停車入口無法載入')
 city.transport=await trafficResponse.json()
 const destinations={zhonglin:'P中林東',linjin:'P林金西進',jianfu:'P建復進',fudun:'P復敦進',dunyan:'P敦延',yanji:'P延吉進'}
 const params=new URLSearchParams(location.search),place=params.get('parking')
 const approach=city.transport.roads.find(r=>r.id===destinations[place])
 if(approach){
  const [a,b]=approach.p,yaw=Math.atan2(a[1]-b[1],b[0]-a[0])
  city.startView={x:a[0]-1.5*Math.cos(yaw),z:-a[1]-1.5*Math.sin(yaw),yaw}
  $('message').textContent=approach.label+'入口。按 E 上車，沿坡道駛向閘門。'
 }
 const feeder={jianguo:'ground593849724',xinsheng:'ground304148115'}[params.get('ramp')]
 if(feeder){
  const road=city.transport.roads.find(r=>r.id===feeder)
  const points=feeder==='ground304148115'?road.p.slice().reverse():road.p
  const [a,b]=points.slice(-4,-2),yaw=Math.atan2(a[1]-b[1],b[0]-a[0])
  city.startView={x:a[0],z:-a[1],yaw}
  city.startPedestrian={x:a[0]-1.48*Math.sin(yaw),z:-a[1]+1.48*Math.cos(yaw),yaw}
  $('message').textContent='前方是市民高架聯絡匝道。可以步行，或按 E 上車後沿坡道往上。'
 }
 {
  const response=await fetch(assetURL('tour-lanes.json'))
  if(!response.ok)throw Error('導覽車道路線載入失敗')
  city.tourLanes=await response.json()
 }
 const mainline=params.get('tour')==='mainline'
 const interchange=mainline||params.get('tour')==='interchanges'
 const tourRoute=mainline?mainlineMovements(city.tourLanes).map(m=>m.leg):interchange?interchangeTour(city):params.get('tour')==='all'?planTour(city):null
 let tour=tourRoute&&createTour(tourRoute),tourSpeed=1
 const arcadeVisit=params.get('walk')==='guangfu'&&!approach&&!feeder
 const returnDrive=params.get('drive')==='guangfu'
 const bridgeDrive=(returnDrive||params.get('drive')==='huashan')&&!approach&&!feeder
 if(bridgeDrive){
  const road=city.transport.roads.find(r=>r.id===(returnDrive?'ground48776358':'civic-1'))
  const i=returnDrive?1:road.p.findIndex(p=>p[0]>=west.start+13),[a,b]=road.p.slice(i,i+2)
  const yaw=Math.atan2(a[1]-b[1],b[0]-a[0])
  city.startView={x:a[0],z:-a[1],yaw,roadId:returnDrive?null:road.id,roadHeight:returnDrive?null:a[2]}
  city.startPedestrian={...city.startView,x:a[0]-1.5*Math.cos(yaw),z:-a[1]-1.5*Math.sin(yaw)}
  $('message').textContent=(returnDrive?'從光復南路出口的平面引道出發。':'從華山高架東行，循光復南路出口下橋。')+'沿光復南路至八德路口，依現場迴轉時段標示接回西向高架。'
 }
 if(arcadeVisit){
  const southbound=city.transport.roads.find(r=>r.id==='GFsurfaceG-1').p
  const i=southbound.findIndex(point=>point[1]>=360),a=southbound[i],b=southbound[i-1]
  const yaw=Math.atan2(a[1]-b[1],b[0]-a[0])
  city.startView={x:a[0],z:-a[1],yaw}
  city.startPedestrian={x:a[0]-1.65,z:-a[1],yaw}
  $('message').textContent='從光復南路西側南下車道出發。按 W 或 ↑ 起步，第一個路口減速按 D 或 → 右轉進市民大道。要逛騎樓，可停車按 E 下車，按 V 切換行人視角。'
 }
 if(tour){
  const [a,b]=tourRoute[0].p
  const yaw=Math.atan2(a[1]-b[1],b[0]-a[0])
  city.startView={x:a[0],z:-a[1],yaw,roadHeight:a[2],roadId:tourRoute[0].id}
  city.startPedestrian={...city.startView,x:a[0]-Math.cos(yaw)*2,z:-a[1]-Math.sin(yaw)*2}
  $('message').textContent='先走完市民高架東、西向全線，再導覽匝道、平面道路及停車設施。路線分段示範，換起點時會停車並提示。可按 V 切換視角、Esc 暫停。'
  $('tourView').hidden=false
  $('tourSpeed').hidden=false
 }
 for(const [x,y,r] of [...city.transport.piers,...(city.transport.parked??[])])city.columns.push([x,-y,r])
 const lastChunk=city.chunks.length-1
 const blockAt=x=>clamp(Math.floor((x-west.start)/100),0,lastChunk)
 const traffic=createTraffic(city,mainline),returnStart=params.get('bus')==='669-return',busStart=(params.get('bus')==='669'||returnStart)&&!tour&&!approach&&!feeder&&!arcadeVisit&&!bridgeDrive
 if(busStart){
  const s=traffic.stops.find(s=>s.route==='669'&&s.destination==='市政府'&&s.name==='華山公園(市民)')
  city.startPedestrian={x:s.poleX+.9*Math.cos(s.angle)+.6*Math.sin(s.angle),z:-s.poleN-.9*Math.sin(s.angle)+.6*Math.cos(s.angle),yaw:-s.angle}
  $('message').textContent='從華山公園站搭 669 往市政府。查看站牌後按 E 候車，上車後可預約市民敦化路口下車。'
 }
 if(busStart&&returnStart){
  const s=traffic.stops.find(s=>s.id===35438)
  city.startPedestrian={x:s.poleX-4.43*Math.cos(s.angle)+.3*Math.sin(s.angle),z:-s.poleN+4.43*Math.sin(s.angle)+.3*Math.cos(s.angle),yaw:Math.PI-s.angle}
  $('message').textContent='市民敦化路口只下客。沿小地圖藍線走到微風廣場，搭 669 往三重回華山公園。'
 }
 const game=createGame(city),textures=new Map(),loader=new T.TextureLoader()
 installStreetFurniture(scene,city)
 const frontages=(await new GLTFLoader().loadAsync(assetURL('frontages.glb'))).scene
 frontages.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})
 scene.add(frontages)
 const detailBlocks=[],gateArms=[]
 const detailScenes=await Promise.all(['arcades.glb','alley-returns.glb','side-streets.glb','transport.glb'].map(async file=>{
  const loader=new GLTFLoader()
  return file==='transport.glb'?loader.parseAsync(await geometryBytes(file),assetURL('')):loader.loadAsync(assetURL(file))
 }))
 for(const {scene:detailScene} of detailScenes){
  detailScene.traverse(o=>{
   if(o.isMesh){o.castShadow=true;o.receiveShadow=true}
   if(o.userData.gate)gateArms.push({object:o,rest:o.quaternion.clone(),angle:0})
   if(Number.isInteger(o.userData.block)){
    o.userData.drawDistance=detailScene===detailScenes[3].scene?5:2
    detailBlocks.push(o)
   }
  })
  scene.add(detailScene)
 }
 const materials=city.mats.map(([idx,color],i)=>{
  const options={color:new T.Color(...color),side:T.DoubleSide}
  const isGlass=[6,21,120,334].includes(i)||(idx>=5009&&idx<=5012)
  const isMetal=[5,11,14,19,419,420].includes(i)
  if(idx===9200){options.alphaTest=.45;options.side=T.DoubleSide}
  const mat=isGlass||isMetal?new T.MeshStandardMaterial({...options,roughness:isGlass?.16:.38,metalness:isGlass?.32:.61}):new T.MeshLambertMaterial(options)
  mat.userData.texture=idx;return mat
 })
 function material(i){
  const mat=materials[i],id=mat.userData.texture
  if(id!==null&&!mat.map){
   if(!textures.has(id)){
    const tex=loader.load(assetURL('t'+id+(id===9200?'.png':'.jpg')),undefined,undefined,()=>{ $('prompt').textContent='部分街景材質載入失敗，請重新開啟遊戲' })
    tex.flipY=false;tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.set(id,tex)
   }
   mat.map=textures.get(id);mat.needsUpdate=true
  }return mat
 }
 // The western road-paint mesh contains both lane dashes and an older set of
 // zebra stripes. At controlled junctions use the zebra that the walkers follow.
 function signalPaintIndices(geometry){
  const pos=geometry.attributes.position,index=geometry.index.array,keep=[]
  for(let i=0;i<index.length;i+=3){
   const tri=[index[i],index[i+1],index[i+2]]
   const stripe=tri.some((a,k)=>{
    const b=tri[(k+1)%3],width=Math.abs(pos.getZ(a)-pos.getZ(b))
    return Math.abs(pos.getX(a)-pos.getX(b))<.002&&width>.40&&width<.46
   })
   const a=tri[0],x=pos.getX(a),n=-pos.getZ(a),h=pos.getY(a)
   if(stripe&&intersections.some(j=>Math.abs(h-j.h)<2.1&&Math.abs((x-j.x)*j.cos+(n-j.n)*j.sin)<j.half+22&&Math.abs(-(x-j.x)*j.sin+(n-j.n)*j.cos)<j.width+4))continue
   keep.push(...tri)
  }
  if(keep.length===index.length)return
  geometry.userData.originalPaint=geometry.index
  geometry.userData.signalPaint=new T.BufferAttribute(new Uint32Array(keep),1)
  if(traffic.enabled)geometry.setIndex(geometry.userData.signalPaint)
 }
 const blocks=new Map(),pending=new Map()
 let focus=0
 async function loadBlock(id){
  if(blocks.has(id))return
  if(pending.has(id))return pending.get(id)
  const task=(async()=>{
   const buf=await geometryBytes((id<westernCount?'west'+id:'block'+(id-westernCount))+'.bin');if(Math.abs(id-focus)>2)return
   const group=new T.Group()
   for(const [m,off,n,count] of city.chunks[id]){
    const geo=new T.BufferGeometry(),vb=new T.InterleavedBuffer(new Float32Array(buf,off,n*8),8)
    for(const [name,size,offset] of [['position',3,0],['normal',3,3],['uv',2,6]])geo.setAttribute(name,new T.InterleavedBufferAttribute(vb,size,offset))
    geo.setIndex(new T.BufferAttribute(new Uint32Array(buf,off+n*32,count),1));if(id<westernCount&&m===701)signalPaintIndices(geo)
    const mesh=new T.Mesh(geo,material(m));mesh.receiveShadow=true;const facade=id<westernCount && west.detailOffsets[id]!=null && off>=west.detailOffsets[id]
    mesh.castShadow=m<198||(m>=411&&m<=452)||m===351||(facade&&m!==18);group.add(mesh)
   }scene.add(group);blocks.set(id,group)
  })();pending.set(id,task)
  try{await task}finally{pending.delete(id)}
 }
 let lastBlock=-1
 function stream(x){
  focus=blockAt(x)
  if(lastBlock===focus)return
  lastBlock=focus
  for(const detail of detailBlocks)detail.visible=Math.abs(detail.userData.block-focus)<=detail.userData.drawDistance
  for(const [id,g] of blocks)if(Math.abs(id-focus)>2){scene.remove(g);g.traverse(o=>o.geometry?.dispose());blocks.delete(id)}
  const retain=new Set()
  for(let i=Math.max(0,focus-2);i<=Math.min(lastChunk,focus+2);i++)for(const [m] of city.chunks[i])retain.add(city.mats[m][0])
  for(const [id,tex] of textures)if(!retain.has(id)){
   for(const mat of materials)if(mat.map===tex){mat.map=null;mat.needsUpdate=true}
   tex.dispose();textures.delete(id)
  }
  for(let i=Math.max(0,focus-2);i<=Math.min(lastChunk,focus+2);i++)loadBlock(i).catch(fail)
 }
 const solid=(color)=>new T.MeshStandardMaterial({color,roughness:.65})
 function part(root,geo,mat,x,y,z){
  const m=new T.Mesh(geo,mat);m.position.set(x,y,z);root.add(m);return m
 }
 function box(root,dims,col,pos){return part(root,new T.BoxGeometry(...dims),solid(col),...pos)}
 // Simplified far facades preserve the street silhouette beyond the loaded survey blocks.
 const lod=new T.Group();scene.add(lod)
 for(const [l,r,y,slope,side,roof,g] of city.walls){
  const m=box(lod,[r-l,roof-g,9],0xb8b6a9,[(r+l)/2,(roof+g)/2,-y-slope*(r-l)/2-side*4.55]);m.userData.block=blockAt((l+r)/2)
 }
 const vehicle=await loadVehicle(),carModel=vehicle.root;scene.add(carModel)
 const patch=document.createElement('canvas');patch.width=patch.height=64
 const brush=patch.getContext('2d'),gradient=brush.createRadialGradient(32,32,3,32,32,31)
 gradient.addColorStop(0,'rgba(11,14,14,.64)');gradient.addColorStop(.6,'rgba(15,18,16,.44)');gradient.addColorStop(1,'rgba(18,21,19,0)');brush.fillStyle=gradient;brush.fillRect(0,0,64,64)
 const shadow=new T.Mesh(new T.PlaneGeometry(5.5,2.83),new T.MeshBasicMaterial({map:new T.CanvasTexture(patch),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.038;carModel.add(shadow)
 const baseVerts=[],baseIndices=[]
 const cuts=city.transport.roads.filter(r=>r.kind==='parking').flatMap(r=>r.p.slice(1).map((q,i)=>{
  const p=r.p[i],pad=r.w/2+.45
  return [Math.min(p[0],q[0])-pad,Math.max(p[0],q[0])+pad,Math.min(-p[1],-q[1])-pad,Math.max(-p[1],-q[1])+pad]
 }))
 for(let i=0;i<city.routeProfile.length-1;i+=4){
  const next=Math.min(i+4,city.routeProfile.length-1),x=west.start+i,x1=west.start+next
  const [c,y]=city.routeProfile[i],[c1,y1]=city.routeProfile[next]
  const holes=cuts.filter(v=>v[0]<x1&&v[1]>x).map(v=>[v[2]+Math.min(c,c1),v[3]+Math.max(c,c1)]).sort((a,b)=>a[0]-b[0])
  function patch(l,r){
   if(r<=l)return
   const j=baseVerts.length/3;baseVerts.push(x,y-.31,-c+l,x,y-.31,-c+r,x1,y1-.31,-c1+l,x1,y1-.31,-c1+r);baseIndices.push(j,j+2,j+1,j+2,j+3,j+1)
  }
  let edge=-52;for(const [lo,hi] of holes){patch(edge,lo);edge=Math.max(edge,hi)}patch(edge,52)
 }
 const substrate=new T.BufferGeometry();substrate.setAttribute('position',new T.Float32BufferAttribute(baseVerts,3));substrate.setIndex(baseIndices);scene.add(new T.Mesh(substrate,new T.MeshBasicMaterial({color:0x77756c,side:T.DoubleSide})))
 sun.shadow.camera.layers.enable(1)
 const [female,male]=await Promise.all([loadCitizen('female'),loadCitizen('male')])
 const citizens={female,male}
 const drawTraffic=installTraffic(scene,traffic,city,game,vehicle,citizens)
 const pass=passengerService(traffic,game)
 const busAudio=createBusAudio(traffic,pass)
 let transfer=null
 function startReturn(){transfer=returnWalk(game,traffic,game.person,traffic.stops.find(s=>s.id===35459))}
 function clearReturn(){transfer?.clear();transfer=null}
 if(returnStart&&busStart)startReturn()
 $('walkReturn').onclick=()=>transfer?.toggle()
 let windowView=false,offAfterExit=false
 city.walkBlocked=(x,z,h)=>traffic.enabled&&((transfer&&!transfer.allow(x,z))||traffic.stops.some(s=>Math.abs(s.h-h)<2&&Math.hypot(s.poleX-x,s.poleN+z)<.32)||traffic.cars.some(c=>{
  if(c.wait||Math.abs(c.h-h)>1.8||Math.abs(c.x-x)>7||Math.abs(c.n+z)>7)return false
  const dx=x-c.x,dn=-z-c.n,cs=Math.cos(c.angle),sn=Math.sin(c.angle)
  return Math.abs(dx*cs+dn*sn)<c.length/2+.24&&Math.abs(dx*sn-dn*cs)<(c.type===4?1.24:1)+.24
 }))
 function setTraffic(on){
  if(!on&&pass.bus){offAfterExit=true;pass.bell(pass.requested??pass.next());$('menuTraffic').checked=true;return}
  if(!on){pass.reset();clearReturn()}
  offAfterExit=false
  if(on)traffic.clearOverlap({x:game.car.x,n:-game.car.z,h:game.car.roadHeight??game.sample(game.car.x,1)})
  traffic.setEnabled(on)
  for(const block of blocks.values())for(const mesh of block.children){
   const g=mesh.geometry
   if(g.userData.signalPaint)g.setIndex(on?g.userData.signalPaint:g.userData.originalPaint)
  }
  localStorage.setItem('civicTraffic',on?'on':'off')
  $('traffic').setAttribute('aria-pressed',String(on));$('traffic').textContent='交通模擬　'+(on?'開':'關');$('menuTraffic').checked=on
 }
 setTraffic(interchange||busStart||localStorage.getItem('civicTraffic')!=='off')
 $('traffic').onclick=()=>setTraffic(!traffic.enabled)
 $('menuTraffic').onchange=()=>setTraffic($('menuTraffic').checked)
 let gender=localStorage.getItem('civicHero')==='male'?'male':'female'
 let citizen=citizens[gender],human=citizen.root
 scene.add(human)
 $('hero').disabled=false
 $('hero').value=gender
 $('hero').onchange=()=>{
  gender=$('hero').value;localStorage.setItem('civicHero',gender)
  human.removeFromParent();citizen=citizens[gender];human=citizen.root;scene.add(human)
 }
 for(const model of [carModel,human])model.traverse(o=>{if(o.isMesh&&o!==shadow){o.castShadow=true;o.receiveShadow=true}})
 let previousFootX=game.person.x,previousFootZ=game.person.z
 const glow=new T.Mesh(new T.RingGeometry(.80,1.02,48),new T.MeshBasicMaterial({color:0xfcb651,side:T.DoubleSide,depthWrite:false}));glow.rotation.x=-Math.PI/2;scene.add(glow)
 let driverView=Boolean(tour)||bridgeDrive,firstPerson=false,zoom=1,paused=true,orbit=0,pitch=.17,last=0,clock=0,drag=null,started=false
 const savedView=localStorage.getItem('civicTourView')
 if(interchange)driverView=false
 else if(tour&&savedView)driverView=savedView==='driver'
 function updateViewChoice(){
  $('tourView').textContent='視角：'+(driverView?'駕駛座':'車後第三人稱')
  if(tour)localStorage.setItem('civicTourView',driverView?'driver':'rear')
 }
 function toggleView(){
  if(pass.bus){windowView=!windowView;orbit=0;pitch=0;return}
  if(game.riding)driverView=!driverView
  else firstPerson=!firstPerson
  updateViewChoice();centerView()
 }
 updateViewChoice()
 $('tourView').onclick=toggleView
 $('passView').onclick=toggleView
 $('busAction').onclick=()=>pass.action()
 $('bookDun').onclick=()=>pass.bell(dunhua())
 function dunhua(){const b=pass.bus;return b?.stations.slice(b.index).find(s=>s.name===(b.stations[0].destination==='三重'?'華山公園(市民)':'市民敦化路口')&&s.m>b.m+1)}
 const keys=new Set()
 const eyeView=()=>game.riding?driverView:firstPerson
 function centerView(){orbit=0;pitch=eyeView()?0:.17}
 function overlay(){busAudio.pause();paused=true;keys.clear();if(!menu.open)menu.showModal()}
 function begin(){busAudio.start();if(!started&&(tour||bridgeDrive||arcadeVisit)){game.interact();if(tour){tour.place(game.car);traffic.stage(game.car.roadId)}centerView()}menu.close();paused=false;last=performance.now();started=true;$('reset').hidden=false;start.textContent='繼續漫遊';canvas.focus()}
 $('tourSpeed').onclick=()=>{tourSpeed=tourSpeed===4?1:tourSpeed*2;$('tourSpeed').textContent='導覽速度 '+tourSpeed+'×'}
 start.onclick=begin;$('help').onclick=overlay
 $('reset').onclick=()=>{pass.reset();clearReturn();offAfterExit=false;game.reset();if(returnStart&&busStart)startReturn();if(tourRoute)tour=createTour(tourRoute);if(!tour)driverView=bridgeDrive;firstPerson=false;started=false;centerView();begin()}
 menu.addEventListener('cancel',e=>{e.preventDefault();if(started)begin()})
 window.addEventListener('blur',()=>{if(!paused)overlay()})
 window.addEventListener('keydown',e=>{
  if(paused)return
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code))e.preventDefault()
  keys.add(e.code);if(e.repeat)return
  if(e.code==='Escape'){e.preventDefault();overlay()}
  if(e.code==='KeyB'&&pass.bus)pass.bell()
  if(e.code==='KeyE'&&!tour){if(pass.bus||pass.nearby()){pass.action();return}game.interact();centerView();if(game.riding&&!driverView)orbit=-.30}
  if(e.code==='KeyV')toggleView()
  if(e.code==='KeyC')centerView()
 })
 window.addEventListener('keyup',e=>keys.delete(e.code))
 canvas.addEventListener('wheel',e=>{if(!paused&&game.riding){e.preventDefault();zoom=clamp(zoom*Math.exp(e.deltaY*.0015),.60,1.35)}},{passive:false})
 canvas.onpointerdown=e=>{if(!paused){drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)}}
 canvas.onpointermove=e=>{if(drag){orbit-=(e.clientX-drag[0])*.009;pitch=clamp(pitch+(e.clientY-drag[1])*.005,eyeView()?-1.25:-.20,.8);drag=[e.clientX,e.clientY]}}
 canvas.onpointerup=canvas.onpointercancel=()=>{drag=null}
 function height(a){if(a.roadHeight!=null)return a.roadHeight+.025;const delta=a.z-game.center(a.x);return game.sample(a.x,1)+(Math.abs(delta)>game.sample(a.x,delta>0?2:3)?.15:.025)}
 function pose(obj,a){obj.position.set(a.x,height(a),a.z);obj.rotation.y=-a.yaw}
 function view(){
  if(pass.bus){
   const a=pass.phase==='ride'?pass.ridePose():game.person,h=a.yaw+orbit+(windowView&&pass.phase==='ride'?Math.PI*.44:0)
   camera.position.set(a.x,height(a)+(pass.phase==='ride'?.74:1.57),a.z)
   camera.lookAt(camera.position.x+Math.cos(h),camera.position.y-Math.tan(pitch),camera.position.z+Math.sin(h));return
  }
  const a=game.actor,y=height(a),h=a.yaw+orbit,d=game.riding?5.75*zoom:3.8,aim=game.riding?.90:1.37
  const lens=!game.riding&&firstPerson?T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(40))/camera.aspect)):61
  if(Math.abs(camera.fov-lens)>.001){camera.fov=lens;camera.updateProjectionMatrix()}
  if(!game.riding&&firstPerson){
   camera.position.set(a.x+Math.cos(a.yaw)*.13,y+1.62,a.z+Math.sin(a.yaw)*.13)
   camera.lookAt(camera.position.x+Math.cos(h),camera.position.y-Math.tan(pitch),camera.position.z+Math.sin(h));return
  }
  if(game.riding && (driverView || (!tour&&a.roadId&&a.roadHeight<game.sample(a.x,1)-.45))){
   citizen.head.getWorldPosition(camera.position)
   camera.position.y+=.095
   camera.position.x+=Math.cos(a.yaw)*.115;camera.position.z+=Math.sin(a.yaw)*.115
   camera.lookAt(camera.position.x+Math.cos(h)*6,camera.position.y+6*((a.roadSlope??0)-Math.tan(pitch))-.16,camera.position.z+Math.sin(h)*6);return
  }
  let back=.24
  for(let t=.24;t<=d;t+=.18){if(!a.roadId&&!game.valid(a.x-Math.cos(h)*t,a.z-Math.sin(h)*t,.11))break;back=t}
  camera.position.set(a.x-Math.cos(h)*back,y+aim+.44+back*Math.sin(pitch),a.z-Math.sin(h)*back)
  const ahead=game.riding?1.0:2.2
  camera.lookAt(a.x+Math.cos(h)*ahead,y+aim,a.z+Math.sin(h)*ahead)
 }
 const drawMap=await createMinimap()
 const labels=['走到車旁，按 E 上車','沿市民大道向東，靠南側停車','步行找到合作金庫復旦分行','已抵達復旦分行，繼續自由漫遊']
 function hud(){
  const a=game.actor,s=game.stage,target=s===0?game.car:game.target,distance=game.dist(a,target)
  $('phase').textContent=s===3?'自由漫遊':'街區任務　'+(s+1)+' / 3'
  $('objective').textContent=labels[s];$('distance').textContent=s===3?'華山 — 八德 — 敦化':Math.round(distance)+' m'
  if(arcadeVisit){
   $('phase').textContent='自由漫遊'
   $('objective').textContent='光復南路兩側騎樓'
   if(game.riding){
    const onRamp=a.roadId==='guangfuWest'||a.roadId==='civic1'
    $('objective').textContent=onRamp?'市民高架西行':a.x<3806?'市民大道':'光復南路 → 市民大道'
    $('distance').textContent=onRamp?'往華山':a.x<3806?'停穩後按 E 下車':-a.z<380&&Math.sin(a.yaw)>.5?'向前慢行，路口右轉':'八德路口迴轉後南下'
   }else $('distance').textContent='往北至八德路口可過街'
  }
  if(bridgeDrive){
   const westbound=a.roadId==='civic1'||a.roadId==='guangfuWest'
   $('phase').textContent='高架往返'
   $('objective').textContent=westbound?'西行回華山':a.roadId?'東行往光復南路出口':'沿光復南路至八德路口迴轉'
   $('distance').textContent=westbound?'市民高架西向':a.roadId?'華山 → 光復南路':'回程循市民高架西向入口'
  }
  if(tour){
   $('phase').textContent=tour.done?'導覽完成':'自動駕駛導覽'
   $('objective').textContent=tour.done?'全路網已走完':tour.label
   $('distance').textContent='已完成 '+tour.completed+' / '+tour.total+' 段　'+(tour.meters/1000).toFixed(2)+' km'
  }
  $('district').textContent=(a.roadId&&game.roadName(a.roadId)) || (a.x<1332?'華山':a.x<2417?'市民八德':'市民敦化')
  $('mode').textContent=game.riding?Math.round(Math.abs(a.v)*3.6)+' km/h':'步行'
  let hint=''
  if(!game.riding&&s===2&&distance<5)hint='E　確認抵達'
  else if(!game.riding&&game.dist(a,game.car)<4.5)hint='E　上車'
  else if(game.riding&&distance<45&&s===1)hint=Math.abs(a.v)>1?'空白鍵　煞車':'E　下車找店'
  $('prompt').textContent=tour?(tour.transfer?'切換至下一段導覽起點':tour.done?'按 Esc 可重新播放':traffic.status):hint||game.notice
  const station=!tour&&pass.nearby(),b=pass.bus,aboard=Boolean(b)
  $('busPanel').hidden=!station&&!aboard
  if(station||b){
   const stop=station??b.stations[b.index]??b.stations.at(-1)
   $('busTitle').textContent=stop.route+'　往'+stop.destination+'　·　'+(station?station.name:'乘車中')
   $('passView').hidden=!aboard;$('passView').textContent=windowView?'切換車廂前視':'切換右側窗景'
   $('bookDun').textContent=b?.stations[0].destination==='三重'?'預約華山公園下車':'預約市民敦化下車'
   $('bookDun').hidden=pass.phase!=='ride'||!dunhua()||Boolean(pass.requested)
   const button=$('busAction')
   if(station){
    const arrival=pass.arrivals(station)
    $('busInfo').textContent=arrival?.open?'公車已靠站':arrival?'預估到站　'+(arrival.seconds<60?Math.max(1,arrival.seconds)+' 秒':Math.ceil(arrival.seconds/60)+' 分鐘'):'等待下一班發車'
    button.disabled=!pass.canBoard(station)
    button.textContent=station.pgp==='-1'?'本站只下客':button.disabled?'模擬路段末站':pass.queued?'已候車 · E 取消':'E 候車搭乘'
   }else{
    $('busInfo').textContent=(pass.phase==='board'?'由前門上車':pass.phase==='exit'?'由中門下車':'下一站　'+(pass.next()?.name??'末站'))+(pass.requested?'　已按鈴：'+pass.requested.name:'')+(offAfterExit?'　下車後關閉交通':'')
    button.disabled=pass.phase!=='ride'||!pass.next();button.textContent='B　按鈴下一站下車'
   }
  }
  if(b||busStart&&!game.riding){
   $('phase').textContent=b?'公車乘客':'自由步行'
   $('objective').textContent=b?'搭乘 '+b.stations[0].route+' 往'+b.stations[0].destination:pass.recent||'華山公園搭 669'
   $('distance').textContent=b?Math.round(b.v*3.6)+' km/h':station?.name??'市民大道'
   $('mode').textContent=b?'公車乘客':'步行';$('prompt').textContent=b?'':pass.recent
  }
  $('transferBar').hidden=!transfer
  if(transfer){
   const remaining=Math.round(Math.hypot(a.x-transfer.stop.poleX,a.z+transfer.stop.poleN))
   $('transferHint').textContent=remaining<5?'微風廣場 · 669 往三重 · 按 E 候車':transfer.waiting?'行人紅燈 · 請在人行道等候':'沿藍線至微風廣場 · 往三重　'+remaining+' m'
   $('walkReturn').hidden=remaining<5
   $('walkReturn').textContent=transfer.auto?'暫停帶路':'沿路線步行'
  }
  glow.visible=!b&&s===2;glow.position.set(target.x,height(target)+.18,target.z)
  drawMap(a,game.car,target,tour||bridgeDrive||arcadeVisit?3:s,game.riding,transfer)
 }
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
 window.addEventListener('resize',resize);resize()
 await loadBlock(0);stream(game.actor.x)
 pose(carModel,game.car)
 const reflection=vehicle.reflect(renderer,scene,carModel.position)
 for(const mat of materials)if(mat.isMeshStandardMaterial){mat.envMap=reflection.texture;mat.envMapIntensity=.74;mat.needsUpdate=true}
 start.disabled=false;start.textContent=tour?'開始自動駕駛導覽':'開始漫遊'
 function frame(now){
  const dt=clamp((now-last)/1000,0,.10);last=now
  if(!paused){
   const delta=tour?dt*tourSpeed:dt
   for(let t=0;t<delta;t+=1/90){
    const step=Math.min(delta-t,1/90)
    if(traffic.enabled)traffic.tick(step,{x:game.car.x,n:-game.car.z,v:game.car.v,angle:-game.car.yaw,roadId:game.car.roadId,h:game.car.roadHeight??game.sample(game.car.x,1)})
    if(tour){
     const transferring=tour.transfer
     tour.tick(game.car,step,traffic.enabled?traffic:null)
     if(transferring&&!tour.transfer&&traffic.enabled)traffic.stage(game.car.roadId)
     if(transferring&&!tour.transfer&&traffic.enabled)traffic.clearOverlap({x:game.car.x,n:-game.car.z,h:game.car.roadHeight})
    }
    else{
     const exiting=pass.bus
     if(!pass.bus&&!(transfer&&!game.riding&&transfer.step(step,keys)))game.tick(step,keys)
     pass.tick(step)
     if(exiting&&!pass.bus&&pass.lastExit?.id===35438)startReturn()
     if(transfer&&(pass.bus||game.riding))clearReturn()
     if(offAfterExit&&pass.phase==='ride'&&!pass.requested)pass.bell()
     if(!pass.bus&&offAfterExit)setTraffic(false)
    }
   }
   busAudio.update(game.actor)
   clock+=dt
  }
  const input=(right,left)=>Number(keys.has(right))-Number(keys.has(left))
  vehicle.update(paused?0:dt,game.car.v,game.riding?Math.sign(input('KeyD','KeyA')+input('ArrowRight','ArrowLeft')):0,game.riding&&(keys.has('Space')||(game.car.v>0&&(keys.has('KeyS')||keys.has('ArrowDown')))))
  pose(carModel,game.car)
  carModel.rotation.order='YXZ';carModel.rotation.z=Math.atan(game.car.roadSlope??0)
  for(const gate of gateArms){
   const open=[game.car,game.person].some(a=>a.roadId===gate.object.userData.gate && Math.hypot(a.x-gate.object.position.x,a.z-gate.object.position.z)<12)
   gate.angle=T.MathUtils.damp(gate.angle,open?1.46:0,7,dt)
   gate.object.quaternion.copy(gate.rest);gate.object.rotateZ(gate.angle)
  }
  if(game.riding){
   if(human.parent!==carModel)carModel.add(human)
   human.position.copy(vehicle.driverSeat);human.rotation.set(0,0,0)
  }else{
   if(human.parent!==scene)scene.add(human)
   pose(human,pass.phase==='ride'?pass.ridePose():game.person)
  }
  citizen.setView(pass.bus?true:eyeView(),game.riding||pass.phase==='ride')
  const step=Math.hypot(game.person.x-previousFootX,game.person.z-previousFootZ)
  const gait=paused||game.riding||!dt?0:Math.min(4.8,step/dt)*(keys.has('KeyS')||keys.has('ArrowDown')?-1:1)
  citizen.update(paused?0:dt,gait,pass.phase==='ride'?'passenger':game.riding,game.riding?input('KeyD','KeyA'):0)
  previousFootX=game.person.x;previousFootZ=game.person.z
  stream(game.actor.x);for(const o of lod.children)o.visible=!blocks.has(o.userData.block)
  const anchor=game.actor;sun.target.position.set(anchor.x,2,anchor.z);sun.position.set(anchor.x-40,84,anchor.z+32)
  drawTraffic(game.actor,paused?0:dt*(tour?tourSpeed:1));view();hud();renderer.render(scene,camera);requestAnimationFrame(frame)
 }
 requestAnimationFrame(frame)
}
function fail(e){console.error(e);if(!menu.open)menu.showModal();$('message').textContent='無法載入街區：'+e.message+'。請使用啟動檔並確認瀏覽器已開啟硬體加速。';start.disabled=true}
run().catch(fail)
