import {assetURL} from './asset-location.js'
// Coordinates use the same east (+X) and south (+Z) metre axes as the game.
const spans=[150,300,600,1200,2400,4800]
const styles=[
 ['#475b54',1,300],['#60736a',1.3,600],['#83968b',1.7,1200],
 ['#b7c7b7',2.6,4800],['#b89a6b',1.6,2400],['#e4bc7c',2.4,4800]
]

export async function createMinimap(){
 const canvas=document.getElementById('map'),ctx=canvas.getContext('2d')
 const zoomIn=document.getElementById('mapIn'),zoomOut=document.getElementById('mapOut'),range=document.getElementById('mapRange')
 const response=await fetch(assetURL('map-roads.json'))
 if(!response.ok)throw Error('周邊道路圖無法讀取')
 const layers=styles.map(()=>[])
 for(const [type,name,points] of await response.json()){
  const path=new Path2D(),xs=points.map(p=>p[0]),zs=points.map(p=>p[1])
  path.moveTo(...points[0]);for(let i=1;i<points.length;i++)path.lineTo(...points[i])
  layers[type].push({name,path,points,left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...zs),bottom:Math.max(...zs)})
 }
 let level=2,lastDraw=-Infinity,lastState='',wheelTime=-Infinity
 function zoom(step){
  level=Math.max(0,Math.min(spans.length-1,level+step))
  zoomIn.disabled=level===0;zoomOut.disabled=level===spans.length-1
  range.textContent='圖寬 '+(spans[level]>=1000?spans[level]/1000+' km':spans[level]+' m')
  lastDraw=-Infinity;lastState=''
 }
 zoom(0)
 zoomIn.onclick=()=>zoom(-1);zoomOut.onclick=()=>zoom(1)
 canvas.addEventListener('wheel',event=>{
  event.preventDefault();event.stopPropagation()
  const now=performance.now()
  if(now-wheelTime>=140&&event.deltaY!==0){zoom(Math.sign(event.deltaY));wheelTime=now}
 },{passive:false})
 const clamp=(v,min,max)=>Math.max(min,Math.min(v,max))
 return function draw(actor,car,target,stage,riding,transfer){
  const now=performance.now()
  if(now-lastDraw<65)return
  lastDraw=now
  const width=canvas.clientWidth,height=canvas.clientHeight,ratio=Math.min(devicePixelRatio,2)
  if(!width||!height)return
  const size=spans[level],scale=width/size,ox=width/2-actor.x*scale,oy=height/2-actor.z*scale
  const state=[width,height,ratio,Math.round(ox*2),Math.round(oy*2),Math.round(actor.yaw*80),car.x,car.z,target.x,target.z,stage,riding,transfer?.index,transfer?.waiting].join('/')
  if(state===lastState)return
  lastState=state
  if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio)}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#1d302b';ctx.fillRect(0,0,width,height)
  const names=[]
  ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round'
  for(let type=0;type<layers.length;type++){
   const [color,weight,maxSpan]=styles[type]
   if(size>maxSpan)continue
   ctx.strokeStyle=color;ctx.lineWidth=weight/scale
   for(const road of layers[type]){
    if(road.right*scale+ox<0||road.left*scale+ox>width||road.bottom*scale+oy<0||road.top*scale+oy>height)continue
    ctx.stroke(road.path)
    if(!road.name||type<2||type===4)continue
    let best=null
    for(let i=1;i<road.points.length;i++){
     const [x,z]=road.points[i-1],[x1,z1]=road.points[i],dx=(x1-x)*scale,dy=(z1-z)*scale
     const len=dx*dx+dy*dy;if(len<16)continue
     const px=x*scale+ox,py=z*scale+oy,t=clamp(((width*.37-px)*dx+(height*.35-py)*dy)/len,.05,.95)
     const u=px+dx*t,v=py+dy*t-7
     if(u<12||u>width-12||v<12||v>height-13)continue
     const distance=Math.hypot(u-width*.4,v-height*.43)
     if(!best||distance<best.distance)best={name:road.name,u,v,distance,rank:type}
    }
    if(best)names.push(best)
   }
  }
  ctx.restore();ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle'
  const used=new Set(),boxes=[[width/2-10,height/2-9,width/2+10,height/2+9],[width-25,0,width,22]]
  names.sort((a,b)=>b.rank-a.rank||a.distance-b.distance)
  for(const {name,u,v} of names){
   if(used.has(name)||used.size>=4)continue
   const half=ctx.measureText(name).width/2+3
   if(half>width/2-5)continue
   const x=clamp(u,half+2,width-half-2),box=[x-half,v-7,x+half,v+7]
   if(boxes.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]))continue
   ctx.lineWidth=3;ctx.strokeStyle='#21332e';ctx.strokeText(name,x,v);ctx.fillStyle='#f3f3e6';ctx.fillText(name,x,v);used.add(name);boxes.push(box)
  }
  function marker(obj,color){
   const dx=(obj.x-actor.x)*scale,dy=(obj.z-actor.z)*scale
   const fit=Math.min(1,(width/2-6)/(Math.abs(dx)||1),(height/2-6)/(Math.abs(dy)||1))
   ctx.save();ctx.translate(width/2+dx*fit,height/2+dy*fit);ctx.fillStyle=color
   if(fit<1){ctx.rotate(Math.atan2(dy,dx));ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(-3,-3);ctx.lineTo(-3,3);ctx.fill()}else{ctx.fillRect(-3,-3,6,6)}
   ctx.restore()
  }
  if(transfer){
   const points=transfer.nodes
   ctx.beginPath()
   for(let i=Math.max(0,transfer.index-1);i<points.length;i++){
    const x=points[i].x*scale+ox,y=points[i].z*scale+oy
    if(i===Math.max(0,transfer.index-1))ctx.moveTo(x,y);else ctx.lineTo(x,y)
   }
   ctx.lineWidth=3;ctx.strokeStyle='#68c8ff';ctx.stroke()
   for(const p of points.filter(p=>p.cross)){
    ctx.fillStyle='#fff3b1';ctx.fillRect(p.x*scale+ox-2,p.z*scale+oy-2,4,4)
   }
   const stop=transfer.stop,x=clamp(stop.poleX*scale+ox,37,width-38),y=clamp(-stop.poleN*scale+oy,12,height-11)
   ctx.fillStyle='#125785';ctx.fillRect(x-34,y-8,68,16);ctx.fillStyle='white';ctx.fillText('微風 · 669',x,y)
  }
  if(!riding&&!transfer)marker(car,'#eee5c8')
  if(stage>0&&stage<3)marker(target,'#ffb248')
  ctx.save();ctx.translate(width/2,height/2);ctx.rotate(actor.yaw);ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,5);ctx.lineTo(-3,0);ctx.lineTo(-5,-5);ctx.closePath();ctx.fillStyle='#78ffda';ctx.strokeStyle='#172820';ctx.lineWidth=2;ctx.stroke();ctx.fill();ctx.restore()
  ctx.fillStyle='#1d302b';ctx.fillRect(width-21,2,19,17);ctx.fillStyle='#dce9df';ctx.fillText('北',width-12,11)
 }
}
