import * as T from './vendor/three.js'
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js'

const tire=0x222528,trim=0x30363a,alloy=0xb6bdc0,glass=0x314956
const V=p=>new T.Vector3(...p)

// Bake the exterior parts once. Instances of the same finish share this mesh.
export function trafficModel(type,paint){
 const parts=[]
 function add(g,color,p=[0,0,0],scale=[1,1,1],rotation){
  g.scale(...scale)
  if(rotation)g.applyQuaternion(rotation)
  g.translate(...p)
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i))
  g.deleteAttribute('uv')
  const c=new T.Color(color),rgb=new Float32Array(g.attributes.position.count*3)
  for(let i=0;i<rgb.length;i+=3){rgb[i]=c.r;rgb[i+1]=c.g;rgb[i+2]=c.b}
  g.setAttribute('color',new T.BufferAttribute(rgb,3));parts.push(g)
 }
 function blob(p,size,color){add(new T.SphereGeometry(1,16,10),color,p,size)}
 function box(p,size,color){add(new T.BoxGeometry(...size),color,p)}
 function rod(a,b,r,color,r2=r,sides=10){
  const u=V(a),v=V(b),axis=v.clone().sub(u)
  const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.clone().normalize())
  add(new T.CylinderGeometry(r2,r,axis.length(),sides),color,u.lerp(v,.5).toArray(),[1,1,1],q)
 }
 function surface(points,indices,color){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3))
  g.setIndex(indices);g.computeVertexNormals();add(g,color)
 }
 function wheel(x,z,r,w,spokes){
  const h=r
  rod([x,h,z-w/2],[x,h,z+w/2],r*.92,tire,r*.92,28)
  for(const s of [-1,1]){
   const side=z+s*w/2
   const hoop=(radius,tube,depth,col)=>{
    const g=new T.TorusGeometry(radius,tube,8,32);add(g,col,[x,h,side+s*depth])
   }
   hoop(r*.87,r*.13,0,tire);hoop(r*.62,r*.042,.007,alloy)
   rod([x,h,side],[x,h,side+s*.012],r*.56,trim,r*.56,24)
   for(let i=0;i<spokes;i++){
    const a=2*Math.PI*i/spokes
    rod([x+r*.16*Math.cos(a),h+r*.16*Math.sin(a),side+s*.021],
     [x+r*.58*Math.cos(a+.16),h+r*.58*Math.sin(a+.16),side+s*.021],r*.048,alloy,r*.068,5)
   }
   blob([x,h,side+s*.025],[r*.19,r*.19,.018],alloy)
  }
 }
 if(type.name==='scooter'){
  for(const x of [-.64,.65])wheel(x,0,.245,.115,5)
  blob([-.48,.40,0],[.40,.15,.19],trim)
  blob([-.44,.57,0],[.46,.20,.245],paint)
  blob([-.42,.738,0],[.41,.081,.233],tire)
  box([.035,.28,0],[.67,.08,.40],trim)
  blob([.40,.58,0],[.14,.35,.226],paint)
  blob([.58,.495,0],[.26,.075,.12],paint)
  for(const s of [-1,1]){
   rod([.65,.246,.081*s],[.43,.85,.081*s],.024,alloy)
   rod([.42,.87,0],[.34,.986,.29*s],.022,trim)
   rod([.42,.96,.21*s],[.47,1.14,.32*s],.01,alloy)
   blob([.47,1.16,.32*s],[.064,.045,.027],trim)
  }
  blob([.45,.93,0],[.13,.105,.205],paint)
  blob([.548,.952,0],[.038,.066,.14],0xffeecf)
  blob([-.833,.595,0],[.035,.052,.16],0xb51d26)
  box([-.831,.47,0],[.016,.11,.20],0xe4e2d8)
  rod([-.77,.324,.17],[-.38,.29,.19],.059,alloy)

 }else{
  const {length:L,width:W,height:H,name}=type
  const van=name==='van',suv=name==='suv',hatch=name==='hatch'
  const base=H*(van?.53:.61),r=suv?.354:van?.34:.313
  const axles=[-.306*L,.303*L]
  // Rounded bumpers, crowned hood and shoulders. Sample actual wheel openings.
  const rings=[],faces=[]
  for(let i=0;i<=96;i++){
   const t=i/96,x=(t-.5)*L,end=Math.max(0,(Math.abs(2*t-1)-.83)/.17)
   const w=W*.5*(1-.12*end*end)
   const y=base-(van?.07:.15)*end*end,dx=Math.min(...axles.map(a=>Math.abs(x-a)))
   const arch=dx<r+.05?r+Math.sqrt((r+.05)**2-dx**2):.22
   const low=Math.min(y-.09,Math.max(.22,arch))
   const ring=[[low,-w*.96],[low+.035,-w],[y-.115,-w],[y-.037,-w*.98],[y,-w*.88],[y+.022,0],[y,w*.88],[y-.037,w*.98],[y-.115,w],[low+.035,w],[low,w*.96],[.214,0]]
   const start=rings.length,N=ring.length
   rings.push(...ring.map(([h,z])=>[x,h,z]))
   if(i)for(let j=0;j<N;j++){
    const a=start-N+j,b=start-N+(j+1)%N
    faces.push(a,b,a+N,b,b+N,a+N)
   }
   if(!i||i===96)for(let j=1;j<N-1;j++)faces.push(start,start+j,start+j+1)
  }
  surface(rings,faces,paint)
  const rear=van?-.47:hatch||suv?-.46:-.38,roofRear=van?-.44:hatch||suv?-.37:-.218
  const roofFront=van?.254:suv?.132:.096,front=van?.416:.313
  const bottom=(x,s)=>[x*L,base-.014,s*W*.461]
  const top=(x,s)=>[x*L,H-.054,s*W*(van?.44:.399)]
  function glazing(pts){
   const points=[],indices=[],tints=[]
   const [a,b,c,d]=pts.map(V),rows=8,columns=6
   for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    const u=i/columns,v=j/rows
    points.push(...a.clone().lerp(b,u).lerp(d.clone().lerp(c,u),v).toArray())
    const tint=new T.Color(glass).lerp(new T.Color(0x8599a2),.13+.35*v+.18*Math.exp(-((v-.41-u*.19)**2)/.006))
    tints.push(tint.r,tint.g,tint.b)
    if(i&&j){const k=j*(columns+1)+i;indices.push(k-columns-2,k-columns-1,k,k-columns-2,k,k-1)}
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3))
   g.setIndex(indices);g.computeVertexNormals();add(g,glass)
   g.setAttribute('color',new T.Float32BufferAttribute(tints,3))
  }
  function panel(a,b,c,d,paintColor,inset){
   surface([a,b,c,d],[0,1,2,0,2,3],paintColor)
   if(!inset)return
   const mid=V(a).add(V(b)).add(V(c)).add(V(d)).multiplyScalar(.25)
   const normal=V(b).sub(V(a)).cross(V(c).sub(V(a))).normalize()
   const pts=[a,b,c,d].map(p=>V(p).lerp(mid,inset).addScaledVector(normal,.006).toArray())
   glazing(pts)
  }
  for(const s of [-1,1]){
   const bounds=[0,van?.28:.19,van?.60:.57,1]
   for(let i=1;i<bounds.length;i++){
    const lo=bounds[i-1],hi=bounds[i],bl=t=>bottom(rear+(front-rear)*t,s),tr=t=>top(roofRear+(roofFront-roofRear)*t,s)
    let pts=[bl(lo),bl(hi),tr(hi),tr(lo)]
    if(s<0)pts.reverse()
    panel(...pts,paint,.085)
    if(i>1){
     const x=bl(lo)[0]
     box([x+.093,base-.12,s*W*.499],[.134,.028,.022],alloy)
     rod([x,base-.085,s*W*.499],[x-.035,.37,s*W*.499],.006,trim)
    }
   }
   if(suv||van){
    rod([roofRear*L+.11,H+.025,s*.32*W],[roofFront*L-.04,H+.025,s*.32*W],.025,alloy)
    for(const x of [roofRear*L+.13,roofFront*L-.07])box([x,H-.009,s*.32*W],[.095,.068,.052],trim)
   }
   box([0,.259,s*(W*.485)],[L*.423,.044,.025],suv?trim:paint)
   const x=front*L-.21
   rod([x,base+.045,s*.453*W],[x-.027,base+.114,s*.534*W],.025,trim)
   blob([x-.05,base+.129,s*.55*W],[.112,.066,.075],paint)
   for(const a of axles)wheel(a,s*(W/2-.107),r,.178,van?6:8)
   for(const f of [-1,1]){
    const x=f*(L/2-.006)
    const lampY=base-.19
    blob([x, lampY,s*W*.293],[.053,.072,W*.141],trim)
    blob([x+f*.027,lampY,s*W*.293],[.037,.044,W*.124],f>0?0xbfcad0:0x9b1921)
    for(const offset of [.263,.335])blob([x+f*.054,lampY,s*W*offset],[.016,.030,.035],f>0?0xf7f2dc:0xdf4133)
    rod([x+f*.049,lampY+.03,s*W*.201],[x+f*.04,lampY+.048,s*W*.375],.009,f>0?0xe6edf0:0xf2645b)
    if(f>0)blob([x+.017,.368,s*W*.33],[.025,.042,.088],trim)
    blob([x+f*.022,base-.18,s*W*.39],[.028,.024,.04],0xd9943c)
   }
  }
  for(const [bottomX,topX,sgn] of [[front,roofFront,1],[rear,roofRear,-1]]){
   panel(bottom(bottomX,sgn),bottom(bottomX,-sgn),top(topX,-sgn),top(topX,sgn),paint,.093)
  }
  const roofMid=(roofFront+roofRear)*L/2
  blob([roofMid,H-.056,0],[(roofFront-roofRear)*L*.53,.056,W*(van?.447:.414)],paint)
  panel(top(roofRear,1),top(roofFront,1),top(roofFront,-1),top(roofRear,-1),paint,0)
  box([L/2+.008,base-.205,0],[.032,.105,W*.285],trim)
  for(const y of [-.035,0,.036])box([L/2+.028,base-.205+y,0],[.011,.008,W*.265],alloy)
  blob([L/2+.042,base-.2,0],[.012,.033,.045],alloy)
  for(const f of [-1,1]){
   box([f*(L/2+.004),.376,0],[.018,.128,W*.61],trim)
   if(f>0)for(let i=0;i<3;i++)box([L/2+.017,.338+i*.041,0],[.016,.009,W*.55],alloy)
   box([f*(L/2+.032),.386,0],[.014,.113,.313],0xe7e5db)
  }
 }
 return mergeGeometries(parts)
}
