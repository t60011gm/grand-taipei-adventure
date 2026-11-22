import {indexTransport} from './transport.js'
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x))
export function createGame(city){
 const base=city.routeStart ?? 2417, profile=city.routeProfile ?? city.profile, end=base+profile.length-1
 function sample(x,k){
  const u=clamp(x-base,0,profile.length-1),i=Math.floor(u),a=profile[i][k]
  return a+(profile[Math.min(i+1,profile.length-1)][k]-a)*(u-i)
 }
 const transport=indexTransport(city.transport)
 const center=x=>-sample(x,0)
 function alleyAccess(x,z,r){
  for(const lane of city.alleyPassages??[]){
   const depth=(-z-lane.y)*lane.s
   if(depth<15 || depth+r>lane.far)continue
   const across=x-lane.x-lane.k*depth*lane.s
   if(across-r<lane.l || across+r>lane.r)continue
   const blocked=lane.obstacles.some(([left,right,near,far])=>across+r>left && across-r<right && depth+r>near && depth-r<far)
   return !blocked
  }
  for(const lane of city.sideStreets??[]){
   const [ex,ey]=lane.axis,dx=x-lane.origin[0],dy=-z-lane.origin[1]
   const along=dx*ex+dy*ey,across=dx*ey-dy*ex
   if(along>=lane.start+r && along<=lane.end-r && across>=lane.left+r && across<=lane.right-r)return true
  }
  return null
 }
 function valid(x,z,r,car=false){
  if((x<base+2+r||x>end-2-r) && !transport.street(x,z,r,!car))return false
  const offset=z-center(x),south=offset>=0,k=car?(south?2:3):(south?4:5)
  const passage=car?null:alleyAccess(x,z,r)
  if(passage===false || (passage===null && Math.abs(offset)+r>sample(x,k) && !transport.street(x,z,r,!car)))return false
  if(Math.abs(x-city.island)<11+r && Math.abs(offset)<5.8+r)return false
  for(const [cx,cy,nx,ny,halfWidth,halfLength] of city.transport?.solids??[]){
   const dx=x-cx,dy=-z-cy
   if(Math.abs(dx*nx+dy*ny)<halfWidth+r && Math.abs(dy*nx-dx*ny)<halfLength+r)return false
  }
  return !city.columns.some(([cx,cz,cr])=>Math.abs(cx-x)<r+cr && Math.hypot(x-cx,z-cz)<r+cr)
 }
 let car,person,riding,stage,notice=''
 function reset(){
  const x=base+14
  car={x,z:center(x)+12,yaw:Math.atan2(center(x+8)-center(x),8),v:0}
  if(city.startView)Object.assign(car,city.startView)
  person=city.startView?{x:car.x-2.7*Math.cos(car.yaw),z:car.z-2.7*Math.sin(car.yaw),yaw:car.yaw}:{x:x-2.7,z:car.z+1.2,yaw:car.yaw}
  if(city.startPedestrian)Object.assign(person,city.startPedestrian)
  riding=false;stage=0;notice=''
 }
 reset()
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)
 const target={x:city.goal[0],z:city.goal[1]}
 function carFits(x,z,yaw){
  return [-1.27,0,1.27].every(t=>valid(x+t*Math.cos(yaw),z+t*Math.sin(yaw),.92,true))
 }
 function clearsCar(x,z,height){
  if(Math.abs(height-(car.roadHeight??sample(car.x,1)))>1.8)return true
  const dx=x-car.x,dz=z-car.z,c=Math.cos(car.yaw),s=Math.sin(car.yaw)
  return Math.abs(dx*c+dz*s)>2.30||Math.abs(-dx*s+dz*c)>1.13
 }
 function walkTo(x,z){
  if(city.walkBlocked?.(x,z,person.roadHeight??sample(x,1)))return false
  const level=transport.move(person,x,z,person.yaw,.27,sample(x,1),true)
  if(!level || (!level.roadId && !valid(x,z,.27)) || !clearsCar(x,z,level.roadHeight??sample(x,1)))return false
  Object.assign(person,{x,z,...level});return true
 }
 function interact(){
  notice=''
  if(!riding && stage===2 && dist(person,target)<5){stage=3;return}
  if(riding){
   if(Math.abs(car.v)>1){notice='請先煞停再下車';return}
   for(const side of [-1,1])for(const t of [0,-1.4,1.4]){
    const x=car.x-side*1.65*Math.sin(car.yaw)+t*Math.cos(car.yaw),z=car.z+side*1.65*Math.cos(car.yaw)+t*Math.sin(car.yaw)
    const level=transport.move(car,x,z,car.yaw,.27,sample(x,1),true)
    if(!level || (!level.roadId && !valid(x,z,.27)))continue
    person={x,z,yaw:car.yaw,...level};riding=false;car.v=0
    if(stage===1 && dist(car,target)<45)stage=2
    return
   }
   notice='車門旁空間不足，請移車';return
  }
  if(dist(car,person)<4.5 && Math.abs((car.roadHeight??sample(car.x,1))-(person.roadHeight??sample(person.x,1)))<1.3){riding=true;if(stage===0)stage=1}
 }
 function tick(dt,keys){
  const up=Number(keys.has('KeyW')||keys.has('ArrowUp')),down=Number(keys.has('KeyS')||keys.has('ArrowDown'))
  const turn=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))
  if(riding){
   let v=car.v
   const brake=keys.has('Space'),rest=brake?14:(!up&&!down?2.2:.45)
   v=Math.sign(v)*Math.max(0,Math.abs(v)-rest*dt)
   if(!brake)v+=dt*(up*(v<0?10:5.8)-down*(v>0?11:3))
   v=clamp(v,-4,19)
   const yaw=car.yaw+turn*dt*clamp(v/4,-1,1)*1.15/(1+Math.abs(v)*.043)
   const x=car.x+v*Math.cos(yaw)*dt,z=car.z+v*Math.sin(yaw)*dt
   const level=transport.move(car,x,z,yaw,.94,sample(x,1))
   if(level && (level.roadId || carFits(x,z,yaw)))Object.assign(car,{x,z,yaw,v,...level});else car.v=0
  }else{
   person.yaw+=turn*dt*2.35
   const step=(up-down)*(keys.has('ShiftLeft')||keys.has('ShiftRight')?4.8:2.3)*dt
   const x=person.x+step*Math.cos(person.yaw),z=person.z+step*Math.sin(person.yaw)
   if(step!==0 && !walkTo(x,z)){
    walkTo(x,person.z)
    walkTo(person.x,z)
   }
  }
 }
 return {get car(){return car},get person(){return person},get riding(){return riding},get stage(){return stage},get notice(){return notice},get actor(){return riding?car:person},reset,tick,walkTo,interact,sample,center,valid,target,dist,roadName:id=>transport.roads.get(id)?.label}
}
