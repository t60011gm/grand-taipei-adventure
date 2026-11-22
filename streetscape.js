import * as T from './vendor/three.js'
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js'

// A shared set of scooter parts is instanced for the observed parking rows.
// +X faces the front wheel. Dimensions are in metres.
function scooterParts(){
 const bins=new Map(),m=new T.Matrix4(),quat=new T.Quaternion(),up=new T.Vector3(0,1,0)
 function put(key,geometry,xyz,scale=[1,1,1],rot=[0,0,0]){
  geometry.applyMatrix4(m.compose(new T.Vector3(...xyz),quat.setFromEuler(new T.Euler(...rot)),new T.Vector3(...scale)))
  const flat=geometry.index?geometry.toNonIndexed():geometry
  for(const a of Object.keys(flat.attributes))if(a!=='normal'&&a!=='position')flat.deleteAttribute(a)
  if(!bins.has(key))bins.set(key,[]);bins.get(key).push(flat)
 }
 function oval(key,x,y,z,sx,sy,sz,angle=0){put(key,new T.SphereGeometry(1,18,12),[x,y,z],[sx,sy,sz],[0,0,angle])}
 function rod(key,a,b,r){
  const delta=new T.Vector3(...b).sub(new T.Vector3(...a)),center=new T.Vector3(...a).addScaledVector(delta,.5)
  const g=new T.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,delta.normalize()));put(key,g,center.toArray())
 }
 function fairing(key,profile){
  const v=[],ix=[],segments=20
  for(const [x,y,ry,rz] of profile)for(let j=0;j<segments;j++){
   const a=j*2*Math.PI/segments;v.push(x,y+Math.cos(a)*ry,Math.sin(a)*rz)
  }
  for(let i=1;i<profile.length;i++)for(let j=0;j<segments;j++){
   const a=(i-1)*segments+j,b=(i-1)*segments+(j+1)%segments;ix.push(a,b,b+segments,a,b+segments,a+segments)
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();put(key,g,[0,0,0])
 }
 for(const x of [-.58,.60]){
  put('tyre',new T.TorusGeometry(.195,.057,10,26),[x,.25,0])
  put('alloy',new T.TorusGeometry(.147,.018,7,24),[x,.25,0])
  for(let j=0;j<6;j++){
   const a=j*Math.PI/3;rod('alloy',[x,.25,.01],[x+.14*Math.cos(a),.25+.14*Math.sin(a),.01],.014)
  }
 }
 fairing('paint',[[-.91,.64,.036,.07],[-.80,.62,.14,.20],[-.57,.56,.185,.255],[-.26,.51,.18,.24],[-.09,.43,.13,.20],[.015,.36,.065,.165]])
 fairing('saddle',[[-.82,.77,.028,.12],[-.68,.79,.067,.216],[-.47,.78,.066,.22],[-.23,.745,.052,.19],[-.11,.735,.036,.13]])
 oval('tyre',.16,.33,0,.36,.05,.19);oval('paint',.47,.68,0,.105,.34,.232,-.22)
 oval('paint',.56,.98,0,.123,.12,.224);oval('lamp',.655,.989,0,.037,.062,.14)
 oval('brake',-.837,.686,0,.044,.05,.17)
 oval('paint',.61,.49,0,.258,.058,.093)
 rod('metal',[.58,.25,-.06],[.49,.87,-.06],.026)
 rod('metal',[-.12,.37,.158],[-.76,.31,.158],.054)
 for(const s of [-1,1]){
  rod('tyre',[.48,.99,s*.15],[.40,1.01,s*.31],.026)
  rod('metal',[.48,1.00,s*.17],[.48,1.19,s*.29],.010)
  oval('mirror',.475,1.20,s*.30,.035,.043,.067)
 }
 put('plate',new T.BoxGeometry(.013,.11,.20),[-.874,.54,0],[1,1,1],[0,0,-.13])
 const colors={tyre:'#252828',alloy:'#a7aaa8',metal:'#7c8281',paint:'#ffffff',saddle:'#353334',lamp:'#d9e4dc',brake:'#a42e27',mirror:'#697477',plate:'#d5d3c5'}
 const parts=[]
 for(const [key,list] of bins){
  const geo=mergeGeometries(list),material=new T.MeshStandardMaterial({color:colors[key],metalness:key==='alloy'?.76:key==='paint'?.35:.13,roughness:key==='paint'?.25:.56,side:T.DoubleSide})
  parts.push({key,geo,material})
 }
 return parts
}
export function installStreetFurniture(scene,city){
 const stock=scooterParts(),points=[],paint=['#485966','#733e42','#a8aaa6','#dcdcd6','#25282c','#74646d','#506776']
 // Only place parked vehicles at verified street-view landmarks. Keep the route
 // across the sidewalk and the mission entrance clear.
 for(const [id,count] of [[13,5],[43,9],[89,4],[110,7],[127,6],[142,3]]){
  const [a,b,y,slope,side]=city.walls[id],mid=id===110?2826:(a+b)/2
  for(let j=0;j<count;j++){
   const x=mid+(j-(count-1)/2)*1.13
   if(id===43&&Math.abs(x-mid)<1.75)continue
   const row=city.profile[Math.round(x-2417)],curb=row[side<0?2:3],depth=Math.abs(y+slope*(x-a)-row[0])
   if(depth<curb+2.15)continue
   const z=-row[0]-side*(curb+.94),yaw=-side*Math.PI/2+.20+.10*Math.sin(j*9+id)
   points.push({x,y:row[1]+.15,z,yaw,color:paint[(j+id)%paint.length]})
   for(const t of [-.43,.43])city.columns.push([x+t*Math.cos(yaw),z+t*Math.sin(yaw),.32])
  }
 }
 // Rows of parked scooters observed along the park, shopfronts and school.
 const westernRows=[
  [43,1,5],[191,-1,4],[239,1,6],[294,-1,5],[390,1,8],[640,1,6],
  [843,-1,4],[941,1,4],[1041,1,9],[1068,1,5],[1194,1,8],[1249,-1,6],
  [1351,-1,4],[1441,-1,3],[1464,1,6],[1497,-1,3],[1641,1,3],
  [1891,1,5],[1941,1,3],[2037,1,3],[2141,1,3],[2163,-1,4],
  [2192,1,10],[2218,-1,3],[2292,1,4],[2341,-1,6],[2384,-1,4]
 ]
 for(const [mid,side,count] of westernRows){
  for(let i=0;i<count;i++){
   const x=mid+(i-(count-1)/2)*1.1
   const row=city.routeProfile[Math.round(x-city.routeStart)]
   const depth=17.9+.14*Math.sin(i*3+mid)
   const z=-row[0]-side*depth,yaw=-side*Math.PI/2+.24+.12*Math.sin(i+mid)
   points.push({x,y:row[1]+.15,z,yaw,color:paint[(i+mid)%paint.length]})
   for(const t of [-.43,.43])city.columns.push([x+t*Math.cos(yaw),z+t*Math.sin(yaw),.32])
  }
 }
 // Spatially grouped instances keep distant scooters out of the draw list.
 const parkingBlocks=new Map()
 for(const point of points){
  const key=Math.floor(point.x/100)
  if(!parkingBlocks.has(key))parkingBlocks.set(key,[])
  parkingBlocks.get(key).push(point)
 }
 const dummy=new T.Object3D()
 for(const block of parkingBlocks.values()){
  for(const {geo,key,material} of stock){
   const batch=new T.InstancedMesh(geo,material,block.length)
   block.forEach((p,i)=>{
    dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(.045,-p.yaw,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix)
    if(key==='paint')batch.setColorAt(i,new T.Color(p.color))
   })
   batch.castShadow=true;batch.receiveShadow=true;scene.add(batch)
  }
 }
 const group=new T.Group();scene.add(group)
 // Trees and planting are concentrated at the surveyed P247 island, bank
 // entrance and hotel corner. Individual leaves retain gaps at eye height.
 const anchor=city.island,rowAt=x=>city.profile[Math.min(city.profile.length-1,Math.max(0,Math.round(x-2417)))]
 let seed=1897
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)
 const shrubs=[],trunks=[],crowns=[]
 for(let i=0;i<30;i++){
  const x=anchor-8.6+17.2*random(),off=(i%2?1:-1)*(2+random()*2.5),row=rowAt(x)
  shrubs.push([x,row[1]+.40,-row[0]+off,.50+random()*.55,.40+random()*.30])
 }
 for(const [x,off,h] of [[anchor-6,1.9,3.3],[anchor+7,-1.7,2.75]]){
  const row=rowAt(x),z=-row[0]+off,y=row[1]+.20;trunks.push([x,y,z,h,.11])
  crowns.push([x,y+h,z,1.62,1.28]);city.columns.push([x,z,.22])
 }
 for(const id of [43,75]){
  const [l,r,y,slope,side,,base]=city.walls[id]
  for(const x of [l+.34,r-.34]){
   const z=-y-slope*(x-l)+side*.87;trunks.push([x,base+.20,z,1.26,.075])
   crowns.push([x,base+1.48,z,.47,.37]);shrubs.push([x,base+.58,z,.46,.24])
  }
 }
 const bark=new T.MeshStandardMaterial({color:0x625b4b,roughness:1})
 const stem=new T.CylinderGeometry(1,1.35,1,10)
 for(const [x,y,z,h,r] of trunks){
  const t=new T.Mesh(stem,bark);t.scale.set(r,h,r);t.position.set(x,y+h*.50,z);t.castShadow=true;group.add(t)
 }
 const leaves=new T.BufferGeometry()
 leaves.setAttribute('position',new T.Float32BufferAttribute([-.44,0,0,0,.32,.17,.50,.04,0,0,-.31,.08],3))
 leaves.setIndex([0,1,2,0,2,3]);leaves.computeVertexNormals()
 const foliage=new T.InstancedMesh(leaves,new T.MeshStandardMaterial({roughness:.90,side:T.DoubleSide}),shrubs.length*140+crowns.length*560)
 let leafIndex=0
 for(const [clusters,count] of [[shrubs,140],[crowns,560]]){
  for(const [x,y,z,r,h] of clusters)for(let i=0;i<count;i++){
   const a=random()*Math.PI*2,b=random()*2-1,t=Math.cbrt(.22+.78*random()),u=Math.sqrt(1-b*b)*t
   const dummy=new T.Object3D();dummy.position.set(x+r*u*Math.cos(a),y+h*b*t,z+r*u*Math.sin(a))
   dummy.rotation.set(random()*2.7,a,random()*1.6)
   const f=.17+random()*.16+(count>200?.16:0);dummy.scale.set(f,f*.64,f);dummy.updateMatrix()
   foliage.setMatrixAt(leafIndex,dummy.matrix);foliage.setColorAt(leafIndex++,new T.Color().setHSL(.208+random()*.048,.22+random()*.20,.115+random()*.12))
  }
 }
 foliage.castShadow=true;foliage.receiveShadow=true;group.add(foliage)
 const marking=document.createElement('canvas');marking.width=256;marking.height=256
 const ink=marking.getContext('2d');ink.fillStyle='#d1ab64';ink.textAlign='center';ink.textBaseline='middle';ink.font='bold 161px sans-serif';ink.fillText('40',128,128)
 const label=new T.CanvasTexture(marking);label.colorSpace=T.SRGBColorSpace
 const markingMat=new T.MeshLambertMaterial({map:label,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})
 for(const off of [9.1,13.45]){
  const x=anchor+19,row=rowAt(x),sign=new T.Mesh(new T.PlaneGeometry(1.6,3.7),markingMat)
  sign.rotation.order='YXZ';sign.rotation.y=-Math.PI/2;sign.rotation.x=-Math.PI/2;sign.position.set(x,row[1]+.065,-row[0]+off);group.add(sign)
 }
}
