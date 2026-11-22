import * as T from './vendor/three.js'

// Metre-scale low-floor city bus. The curbside portals match the passenger controller.
const trim=new T.MeshStandardMaterial({color:0x20282a,roughness:.48})
const enamel=new T.MeshPhysicalMaterial({color:0xf4f1e7,metalness:.18,roughness:.32,clearcoat:.7})
const teal=new T.MeshPhysicalMaterial({color:0x087a78,metalness:.26,roughness:.34,clearcoat:.6})
const alloy=new T.MeshStandardMaterial({color:0xc4cccb,metalness:.68,roughness:.32})
const rubber=new T.MeshStandardMaterial({color:0x28292a,roughness:.94})
const glass=new T.MeshPhysicalMaterial({color:0x739399,transparent:true,opacity:.24,depthWrite:false,roughness:.13,side:T.DoubleSide})
const rail=new T.MeshStandardMaterial({color:0xedbf49,metalness:.25,roughness:.35})
const lamp=new T.MeshStandardMaterial({color:0xfff6d5,emissive:0xffeac3,emissiveIntensity:.65})
const red=new T.MeshStandardMaterial({color:0xbd241e,emissive:0x540900})
const ceiling=new T.MeshStandardMaterial({color:0xe7e1d4})
const fabric=new T.MeshStandardMaterial({color:0x397e88,roughness:.98})
const identity=new T.Matrix4(),matrix=new T.Matrix4(),rotation=new T.Quaternion()
const unit=new T.Vector3(1,1,1),up=new T.Vector3(0,1,0)
const cube=new T.BoxGeometry(),ball=new T.SphereGeometry(1,24,14)
function builder(){
 const batches=new Map()
 function add(g,mat,transform=identity){
  let b=batches.get(mat)
  if(!b){b={p:[],n:[],i:[]};batches.set(mat,b)}
  const a=g.getAttribute('position'),norm=g.getAttribute('normal'),offset=b.p.length/3
  const nm=new T.Matrix3().getNormalMatrix(transform),v=new T.Vector3()
  for(let i=0;i<a.count;i++){
   v.fromBufferAttribute(a,i).applyMatrix4(transform);b.p.push(v.x,v.y,v.z)
   v.fromBufferAttribute(norm,i).applyNormalMatrix(nm);b.n.push(v.x,v.y,v.z)
  }
  for(let i=0;i<(g.index?.count??a.count);i++)b.i.push(offset+(g.index?g.index.getX(i):i))
 }
 function solid(g,m,x,y,z,l,h,w,q=new T.Quaternion()){
  add(g,m,matrix.compose(new T.Vector3(x,y,z),q,new T.Vector3(l,h,w)))
 }
 const box=(m,x,y,z,l,h,w)=>solid(cube,m,x,y,z,l,h,w)
 const oval=(m,x,y,z,l,h,w)=>solid(ball,m,x,y,z,l,h,w)
 function tube(m,a,b,r,segments=12){
  const p=new T.Vector3(...a),v=new T.Vector3(...b).sub(p)
  const g=new T.CylinderGeometry(r,r,v.length(),segments)
  p.addScaledVector(v,.5);add(g,m,matrix.compose(p,rotation.setFromUnitVectors(up,v.normalize()),unit));g.dispose()
 }
 function finish(){
  const root=new T.Group()
  for(const [m,b] of batches){
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3))
   g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setIndex(b.i);g.computeBoundingSphere()
   root.add(new T.Mesh(g,m))
  }
  return root
 }
 return {add,box,oval,tube,finish}
}
function rounded(shape,x,y,w,h,r){
 shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r)
 shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
 shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r)
 shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);shape.closePath()
}
function panel(b,m,x,y,z,w,h,depth,r=.055){
 const shape=new T.Shape();rounded(shape,x,y,w,h,Math.min(r,w/2,h/2))
 const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:8})
 b.add(g,m,new T.Matrix4().makeTranslation(0,0,z));g.dispose()
}
const axles=[-3.12,2.4]
function buildBody(){
 const b=builder(),{box,oval,tube}=b
 // Rounded coach roof and bumper ends, with a true opening above each tyre.
 const cap=(m,y,h,l,w,r)=>{
  const shape=new T.Shape();rounded(shape,-l/2,-w/2,l,w,r)
  const g=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:4})
  g.rotateX(-Math.PI/2);g.translate(0,y,0);b.add(g,m);g.dispose()
 }
 cap(enamel,2.91,.115,10.68,2.39,.24)
 box(trim,0,.43,0,10.35,.14,2.22)
 for(const side of [-1,1]){
  const ranges=side<0?[[-5.18,5.17]]:[[-5.18,-1.25],[-.047,3.177],[4.383,5.17]]
  for(const [lo,hi] of ranges){
   const sh=new T.Shape();sh.moveTo(lo,.28)
   for(const axle of axles)if(axle-.57>lo&&axle+.57<hi){
    sh.lineTo(axle-.57,.28);sh.lineTo(axle-.57,.48);sh.absarc(axle,.48,.57,Math.PI,0,true);sh.lineTo(axle+.57,.28)
    const arc=[]
    for(let i=0;i<=32;i++){const a=i*Math.PI/32;arc.push([axle+.57*Math.cos(a),.48+.57*Math.sin(a),side*1.22])}
    for(let i=1;i<arc.length;i++)tube(trim,arc[i-1],arc[i],.023,8)
   }
   sh.lineTo(hi,.28);sh.lineTo(hi,1.34);sh.lineTo(lo,1.34);sh.closePath()
   const g=new T.ExtrudeGeometry(sh,{depth:.065,bevelEnabled:false,curveSegments:32});g.translate(0,0,side===1?1.15:-1.215);b.add(g,enamel);g.dispose()
   panel(b,teal,lo,1.07,side*1.219,hi-lo,.15,.009,.012)
   panel(b,alloy,lo,1.265,side*1.222,hi-lo,.022,.009,.008)
   const count=Math.ceil((hi-lo)/1.58)
   for(let i=0;i<count;i++){
    const x=lo+i*(hi-lo)/count,w=(hi-lo)/count
    box(trim,x+w/2,2.78,side*1.175,w,.27,.095)
    box(trim,x+w/2,1.37,side*1.186,w,.09,.07)
    box(trim,x+.025,2.03,side*1.19,.058,1.36,.08)
    panel(b,glass,x+.055,1.418,side*1.185,w-.09,1.23,.009,.06)
    box(trim,x+w/2,2.42,side*1.20,w-.08,.025,.035)
    if(i>0)box(alloy,x,.74,side*1.222,.014,.71,.013)
   }
  }
  for(const x of [-4.7,-1.5,1.53,4.65])oval(rail,x,.84,side*1.228,.072,.034,.017)
  for(let i=0;i<13;i++)box(trim,-4.97+i*.071,.77,side*1.225,.023,.40,.016)
  tube(alloy,[4.62,2.81,side*1.16],[4.94,2.82,side*1.47],.033)
  tube(trim,[4.94,2.82,side*1.47],[4.94,2.43,side*1.48],.032)
  oval(trim,4.94,2.32,side*1.48,.088,.20,.11);oval(alloy,4.88,2.32,side*1.48,.04,.16,.086)
 }
 for(const end of [-1,1]){
  const x=end*5.23
  oval(enamel,x, .88,0,.167,.57,1.21)
  box(enamel,x,.93,0,.24,.72,2.18)
  box(trim,end*5.35,.44,0,.09,.12,2.1)
  box(trim,x,2.68,0,.22,.52,2.27)
  for(const side of [-1,1]){
   tube(trim,[end*5.27,1.24,side*1.13],[end*5.09,2.81,side*1.13],.095)
   oval(trim,end*5.36,.93,side*.89,.065,.137,.235)
   for(const z of [.8,.99])oval(end>0?lamp:red,end*5.411,.95,side*z,.021,.073,.081)
  }
  box(glass,x,1.91,0,.025,1.24,2.19)
  box(trim,x,1.27,0,.2,.07,2.24)
  for(let i=0;i<5;i++)box(trim,end*5.374,.57+i*.043,0,.014,.018,.74)
 }
 for(const z of [-.46,.52]){
  tube(trim,[5.29,1.31,z],[5.28,1.57,z-.29],.021)
  tube(trim,[5.28,1.43,z-.59],[5.28,1.72,z+.02],.022)
 }
 // Roof climate pack, grilles, condenser fans and emergency hatch.
 box(ceiling,-1.15,3.11,0,3.22,.19,1.46)
 for(const x of [-2,-.95]){
  tube(trim,[x,3.19,0],[x,3.222,0],.43,48)
  for(let i=-4;i<=4;i++)box(alloy,x+i*.078,3.235,0,.017,.016,2*Math.sqrt(.42**2-(i*.078)**2))
 }
 box(alloy,2.13,3.08,0,.83,.055,.71)
 for(const side of [-1,1])for(let i=0;i<23;i++)box(trim,-2.63+i*.13,3.11,side*.738,.069,.088,.012)
 // Hollow wheel tubs: the cabin sees the inner wall and arched cover, not the tyre.
 for(const x of axles)for(const side of [-1,1]){
  const sh=new T.Shape()
  sh.absarc(x,.48,.557,0,Math.PI,false);sh.absarc(x,.48,.505,Math.PI,0,true);sh.closePath()
  const g=new T.ExtrudeGeometry(sh,{depth:.39,bevelEnabled:false,curveSegments:38})
  g.translate(0,0,side>0?.82:-1.21);b.add(g,trim);g.dispose()
  const end=new T.Shape();end.absarc(x,.48,.554,0,Math.PI,false);end.lineTo(x+.554,.48);end.closePath()
  const wall=new T.ExtrudeGeometry(end,{depth:.028,bevelEnabled:false,curveSegments:38})
  wall.translate(0,0,side>0?.81:-.84);b.add(wall,ceiling);wall.dispose()
 }
 // Saloon, driver console and fitted seat shells.
 box(trim,0,.43,0,10.38,.095,2.3);box(ceiling,0,2.89,0,10.37,.07,2.26)
 for(const x of [-4.72,-3.91,-2.95,-2.01,.36,1.4,2.47]){
  for(const z of [-.76,.76]){
   if(x>2&&z>0)continue
   box(alloy,x,.67,z,.08,.4,.08)
   oval(trim,x,.85,z,.30,.085,.27);oval(fabric,x+.02,.90,z,.28,.085,.25)
   oval(trim,x-.24,1.2,z,.086,.38,.27);oval(fabric,x-.188,1.2,z,.058,.34,.24)
   tube(rail,[x-.24,1.46,z-.17],[x-.24,1.55,z-.15],.022)
   tube(rail,[x-.24,1.55,z-.15],[x-.24,1.55,z+.15],.022)
   tube(rail,[x-.24,1.55,z+.15],[x-.24,1.46,z+.17],.022)
  }
 }
 for(const side of [-1,1]){
  tube(rail,[-4.85,2.55,side*.49],[4.05,2.55,side*.49],.029)
  for(const x of [-4.25,-2.18,.04,2.99])tube(rail,[x,.49,side*.5],[x,2.86,side*.5],.028)
  for(const x of [-3.61,-2.85,-1.54,-.15,.74,1.65,2.48]){
   tube(trim,[x,2.54,side*.49],[x,2.37,side*.49],.014)
   const g=new T.TorusGeometry(.083,.016,8,22);g.translate(x,2.30,side*.49);b.add(g,rail);g.dispose()
  }
  for(const x of [-3.3,0,3.3])box(lamp,x,2.84,side*.79,2.6,.014,.052)
 }
 box(trim,4.75,1.11,-.59,.81,.41,.94)
 const wheel=new T.TorusGeometry(.205,.021,12,40);wheel.rotateY(1.01);wheel.translate(4.43,1.43,-.57);b.add(wheel,trim);wheel.dispose()
 oval(trim,4.04,.93,-.6,.33,.10,.31);oval(fabric,3.78,1.31,-.6,.10,.48,.32)
 for(const x of [-2.18,2.99]){
  oval(rail,x,1.39,.51,.062,.098,.050);oval(red,x+.042,1.39,.51,.032,.044,.033)
 }
 for(const x of [-.648,3.78])box(rail,x,.475,1.13,1.12,.016,.12)
 return b.finish()
}
function buildWheel(){
 const b=builder()
 const profile=[[.305,-.155],[.405,-.153],[.46,-.12],[.48,-.085],[.48,.085],[.46,.12],[.405,.153],[.305,.155],[.305,-.155]]
 const tyre=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),64)
 tyre.rotateX(Math.PI/2);b.add(tyre,rubber)
 for(const z of [-.065,-.021,.021,.065]){
  const tread=new T.TorusGeometry(.478,.004,6,64);tread.translate(0,0,z);b.add(tread,trim)
 }
 b.tube(alloy,[0,0,-.13],[0,0,.139],.315,64)
 const ring=new T.TorusGeometry(.282,.024,12,56);ring.translate(0,0,.15);b.add(ring,alloy)
 b.oval(alloy,0,0,.146,.145,.145,.061)
 for(let i=0;i<10;i++){
  const a=i*2*Math.PI/10,x=Math.cos(a),y=Math.sin(a)
  b.oval(trim,x*.221,y*.221,.141,.044,.042,.011)
  b.tube(alloy,[x*.131,y*.131,.166],[x*.131,y*.131,.20],.025,6)
 }
 return b.finish()
}
let coachTemplate,wheelTemplate
export function coach(){
 coachTemplate??=buildBody();wheelTemplate??=buildWheel()
 const root=coachTemplate.clone(),wheels=[]
 for(const x of axles)for(const side of [-1,1]){
  const wheel=wheelTemplate.clone();wheel.position.set(x,.48,side*1.075)
  if(side<0)wheel.rotation.y=Math.PI
  root.add(wheel);wheels.push({wheel,side})
 }
 return {root,wheels}
}
export function doorLeaf(){
 // Open glazed areas in the frame.
 const frame=builder()
 for(const x of [-.263,.263])frame.box(trim,x,0,0,.028,2.28,.065)
 for(const y of [-1.10,-.12,1.09])frame.box(trim,0,y,0,.55,.075,.06)
 panel(frame,glass,-.242,-1.055,-.012,.484,.895,.022,.034)
 panel(frame,glass,-.242,-.075,-.012,.484,1.12,.022,.034)
 frame.box(teal,0,-1.04,.024,.50,.044,.016)
 frame.tube(rail,[0,-.32,-.07],[0,.32,-.07],.016)
 return frame.finish()
}
